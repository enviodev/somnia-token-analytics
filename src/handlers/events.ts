import { indexer } from "envio";
import { handleTransfer, handleMint, handleBurn } from "../tokenLogic";

indexer.onEvent({ contract: "ERC20", event: "Transfer" }, async ({ event, context }) => {
  const { from, to, value } = event.params;
  await handleTransfer(context, event.srcAddress, from, to, value, event.block.timestamp);
});

indexer.onEvent({ contract: "WSOMI", event: "Transfer" }, async ({ event, context }) => {
  const { src, dst, wad } = event.params;
  await handleTransfer(context, event.srcAddress, src, dst, wad, event.block.timestamp);
});

indexer.onEvent({ contract: "WSOMI", event: "Deposit" }, async ({ event, context }) => {
  await handleMint(context, event.srcAddress, event.params.dst, event.params.wad);
});

indexer.onEvent({ contract: "WSOMI", event: "Withdrawal" }, async ({ event, context }) => {
  await handleBurn(context, event.srcAddress, event.params.src, event.params.wad);
});
