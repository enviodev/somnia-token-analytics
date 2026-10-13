import type { EvmOnEventContext, Token } from "envio";
import { TOKENS } from "./tokens";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const SECONDS_PER_DAY = 86400;

type Ctx = EvmOnEventContext;

async function loadToken(context: Ctx, address: string): Promise<Token> {
  const id = address.toLowerCase();
  const existing = await context.Token.get(id);
  if (existing) return existing;
  const meta = TOKENS[id] ?? { symbol: "UNKNOWN", decimals: 18 };
  return {
    id,
    symbol: meta.symbol,
    decimals: meta.decimals,
    totalSupply: 0n,
    holderCount: 0,
    transferCount: 0,
    volume: 0n,
  };
}

// Adds delta to an account's balance and returns the change in holder count
async function changeBalance(context: Ctx, tokenId: string, account: string, delta: bigint): Promise<number> {
  const id = `${tokenId}-${account.toLowerCase()}`;
  const existing = await context.AccountBalance.get(id);
  const before = existing?.balance ?? 0n;
  const after = before + delta;
  context.AccountBalance.set({ id, token_id: tokenId, account, balance: after });
  if (before <= 0n && after > 0n) return 1;
  if (before > 0n && after <= 0n) return -1;
  return 0;
}

export async function handleTransfer(
  context: Ctx,
  tokenAddress: string,
  from: string,
  to: string,
  value: bigint,
  timestamp: number,
) {
  const token = await loadToken(context, tokenAddress);
  const isMint = from === ZERO_ADDRESS;
  const isBurn = to === ZERO_ADDRESS;

  let holderChange = 0;
  if (!isMint) holderChange += await changeBalance(context, token.id, from, -value);
  if (!isBurn) holderChange += await changeBalance(context, token.id, to, value);

  let totalSupply = token.totalSupply;
  if (isMint) totalSupply += value;
  if (isBurn) totalSupply -= value;

  // Volume counts transfers between accounts, not mints or burns
  const isMove = !isMint && !isBurn;
  context.Token.set({
    ...token,
    totalSupply,
    holderCount: token.holderCount + holderChange,
    transferCount: token.transferCount + (isMove ? 1 : 0),
    volume: token.volume + (isMove ? value : 0n),
  });

  if (isMove) await addDailyVolume(context, token.id, value, timestamp);
}

// WSOMI's Deposit and Withdrawal change supply and balances without a Transfer event
export async function handleMint(context: Ctx, tokenAddress: string, to: string, value: bigint) {
  const token = await loadToken(context, tokenAddress);
  const holderChange = await changeBalance(context, token.id, to, value);
  context.Token.set({ ...token, totalSupply: token.totalSupply + value, holderCount: token.holderCount + holderChange });
}

export async function handleBurn(context: Ctx, tokenAddress: string, from: string, value: bigint) {
  const token = await loadToken(context, tokenAddress);
  const holderChange = await changeBalance(context, token.id, from, -value);
  context.Token.set({ ...token, totalSupply: token.totalSupply - value, holderCount: token.holderCount + holderChange });
}

async function addDailyVolume(context: Ctx, tokenId: string, value: bigint, timestamp: number) {
  const day = Math.floor(timestamp / SECONDS_PER_DAY);
  const id = `${tokenId}-${day}`;
  const existing = await context.DailyVolume.get(id);
  context.DailyVolume.set({
    id,
    token_id: tokenId,
    dayStartTimestamp: day * SECONDS_PER_DAY,
    transferCount: (existing?.transferCount ?? 0) + 1,
    volume: (existing?.volume ?? 0n) + value,
  });
}
