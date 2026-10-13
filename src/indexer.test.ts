import { describe, it } from "vitest";
import { createTestIndexer, TestHelpers } from "envio";

const { Addresses } = TestHelpers;
const ZERO = "0x0000000000000000000000000000000000000000" as const;
const USDC = "0x28BEc7E30E6faee657a03e19Bf1128AaD7632A00" as const;
const WSOMI = "0x046EDe9564A72571df6F5e44d0405360c0f4dCab" as const;
const usdcId = USDC.toLowerCase();
const wsomiId = WSOMI.toLowerCase();

describe("ERC20 tokens", () => {
  it("tracks supply, balances, holders and volume", async (t) => {
    const indexer = createTestIndexer();
    const [alice, bob] = [Addresses.mockAddresses[0]!, Addresses.mockAddresses[1]!];
    // Blocks after the ERC20 start block in config.yaml
    const transfer = (from: `0x${string}`, to: `0x${string}`, value: bigint, timestamp: number) => ({
      contract: "ERC20" as const,
      event: "Transfer" as const,
      srcAddress: USDC,
      block: { number: 80_000_000, timestamp },
      params: { from, to, value },
    });

    await indexer.process({
      chains: {
        5031: {
          simulate: [
            transfer(ZERO, alice, 100n, 86400), // mint
            transfer(alice, bob, 30n, 86400 + 10), // day 1
            transfer(bob, bob, 5n, 2 * 86400), // self transfer, day 2
            transfer(bob, ZERO, 30n, 2 * 86400 + 10), // burn
          ],
        },
      },
    });

    const token = await indexer.Token.getOrThrow(usdcId);
    t.expect(token).toMatchObject({
      symbol: "USDC.e",
      decimals: 6,
      totalSupply: 70n,
      holderCount: 1,
      transferCount: 2,
      volume: 35n,
    });
    t.expect((await indexer.AccountBalance.getOrThrow(`${usdcId}-${alice.toLowerCase()}`)).balance).toBe(70n);
    t.expect((await indexer.AccountBalance.getOrThrow(`${usdcId}-${bob.toLowerCase()}`)).balance).toBe(0n);
    t.expect(await indexer.DailyVolume.getOrThrow(`${usdcId}-1`)).toMatchObject({ dayStartTimestamp: 86400, transferCount: 1, volume: 30n });
    t.expect(await indexer.DailyVolume.getOrThrow(`${usdcId}-2`)).toMatchObject({ dayStartTimestamp: 172800, transferCount: 1, volume: 5n });
  });
});

describe("WSOMI", () => {
  it("counts Deposit and Withdrawal as mint and burn", async (t) => {
    const indexer = createTestIndexer();
    const alice = Addresses.mockAddresses[0]!;

    await indexer.process({
      chains: {
        5031: {
          simulate: [
            { contract: "WSOMI", event: "Deposit", srcAddress: WSOMI, params: { dst: alice, wad: 50n } },
            { contract: "WSOMI", event: "Withdrawal", srcAddress: WSOMI, params: { src: alice, wad: 20n } },
          ],
        },
      },
    });

    t.expect(await indexer.Token.getOrThrow(wsomiId)).toMatchObject({ totalSupply: 30n, holderCount: 1, volume: 0n });
    t.expect((await indexer.AccountBalance.getOrThrow(`${wsomiId}-${alice.toLowerCase()}`)).balance).toBe(30n);
  });

  it("indexes the first real WSOMI deposit on Somnia Mainnet", async (t) => {
    const indexer = createTestIndexer();

    // Block 70612265 has the first WSOMI event, a 0.5 WSOMI deposit
    await indexer.process({ chains: { 5031: { startBlock: 70_612_265, endBlock: 70_612_265 } } });

    t.expect(await indexer.Token.getOrThrow(wsomiId)).toMatchObject({ symbol: "WSOMI", totalSupply: 500000000000000000n, holderCount: 1 });
    t.expect(
      (await indexer.AccountBalance.getOrThrow(`${wsomiId}-0x24ff88d4bdaeef3a7cfc6df39051b217d1ee7a96`)).balance,
    ).toBe(500000000000000000n);
  });
});
