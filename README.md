# Somnia Token Analytics

An [Envio HyperIndex](https://docs.envio.dev/docs/HyperIndex/overview) indexer that tracks balances, holders, total supply and daily volume for the main tokens on [Somnia Mainnet](https://envio.dev/chains/somnia), and serves them through a GraphQL API.

It builds on the [Somnia indexer example](https://github.com/enviodev/somnia-indexer-example) from the "Indexing Somnia with Envio" tutorial in the [Somnia docs](https://docs.somnia.network/developer/building-dapps/data-indexing-and-querying).

## Tokens

The addresses come from Somnia's [Smart Contracts](https://docs.somnia.network/developer/smart-contracts) page.

| Token | Address |
| --- | --- |
| WSOMI | `0x046EDe9564A72571df6F5e44d0405360c0f4dCab` |
| USDC.e | `0x28BEc7E30E6faee657a03e19Bf1128AaD7632A00` |
| USDT | `0x67B302E35Aef5EEE8c32D934F5856869EF428330` |
| WETH | `0x936Ab8C674bcb567CD5dEB85D8A216494704E9D8` |
| WBTC | `0xC5098b3cA516784323872F17235fa074E167D3D2` |
| USDso | `0x00000022dA000002656c64D9eA6011ea952D008A` |

## What it tracks

- `Token` has the total supply, holder count, transfer count and all-time volume for each token.
- `AccountBalance` has every account's balance of each token.
- `DailyVolume` has the transfer count and volume for each token per UTC day.

Mints and burns change supply and balances but are not counted as volume. WSOMI's `Deposit` and `Withdrawal` events are treated as mints and burns, because wrapping and unwrapping SOMI does not emit a `Transfer`.

Balances are only correct when every transfer is indexed, so the indexer starts at each token's deployment block. The first sync indexes the full history of all six tokens, which takes a while. Check progress with the `_meta` query below.

## Run

```bash
pnpm install
cp .env.example .env # then add your ENVIO_API_TOKEN from envio.dev/app/api-tokens
pnpm codegen
pnpm dev
```

Open the Hasura console at http://localhost:8080 and log in with the admin secret `testing`. The GraphQL endpoint is `http://localhost:8080/v1/graphql`.

## Example queries

Token overview, by number of holders.

```graphql
query {
  Token(order_by: { holderCount: desc }) {
    symbol
    decimals
    totalSupply
    holderCount
    transferCount
    volume
  }
}
```

Top holders of a token.

```graphql
query {
  AccountBalance(
    where: { token: { symbol: { _eq: "WSOMI" } } }
    order_by: { balance: desc }
    limit: 10
  ) {
    account
    balance
  }
}
```

Daily volume for a token, most recent first.

```graphql
query {
  DailyVolume(
    where: { token: { symbol: { _eq: "USDC.e" } } }
    order_by: { dayStartTimestamp: desc }
    limit: 7
  ) {
    dayStartTimestamp
    transferCount
    volume
  }
}
```

Every token an account holds.

```graphql
query {
  AccountBalance(
    where: { account: { _ilike: "0xYourWalletAddress" }, balance: { _gt: "0" } }
  ) {
    token {
      symbol
      decimals
    }
    balance
  }
}
```

Indexing progress.

```graphql
query {
  _meta {
    progressBlock
    sourceBlock
    eventsProcessed
    isReady
  }
}
```

Amounts are in each token's smallest unit. Divide by `10^decimals` for the human-readable value.

## Test

```bash
pnpm test
```

The tests cover mints, burns, transfers, self-transfers, holder counts and daily volume with simulated events, plus the first real WSOMI deposit on Somnia Mainnet.

## Files

- `config.yaml` lists the tokens, their events and start blocks.
- `schema.graphql` defines `Token`, `AccountBalance` and `DailyVolume`.
- `src/handlers/events.ts` registers the event handlers.
- `src/tokenLogic.ts` updates supply, balances, holders and volume.
- `src/tokens.ts` holds each token's symbol and decimals.

## Learn more

- [Envio docs](https://docs.envio.dev/docs/HyperIndex/overview)
- [Somnia on Envio](https://envio.dev/chains/somnia)
- [Deploy to Envio Cloud](https://docs.envio.dev/docs/HyperIndex/hosted-service)
- [Envio Discord](https://discord.gg/envio)
