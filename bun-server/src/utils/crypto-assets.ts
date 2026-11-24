/**
 * Crypto Assets Data
 * 
 * List of supported cryptocurrency assets for price lookups.
 */

export interface CryptoAsset {
  assetSymbol: string;
  assetName: string;
  description: string;
  image: string;
}

export const cryptoAssets: CryptoAsset[] = [
  {
    assetSymbol: "BTC",
    assetName: "Bitcoin",
    description: "The first and largest cryptocurrency by market cap",
    image: "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
  },
  {
    assetSymbol: "ETH",
    assetName: "Ethereum",
    description: "Decentralized platform for smart contracts",
    image: "https://assets.coingecko.com/coins/images/279/large/ethereum.png",
  },
  {
    assetSymbol: "SOL",
    assetName: "Solana",
    description: "High-performance blockchain platform",
    image: "https://assets.coingecko.com/coins/images/4128/large/solana.png",
  },
  {
    assetSymbol: "DOGE",
    assetName: "Dogecoin",
    description: "The original meme cryptocurrency",
    image: "https://assets.coingecko.com/coins/images/5/large/dogecoin.png",
  },
  {
    assetSymbol: "ADA",
    assetName: "Cardano",
    description: "Proof-of-stake blockchain platform",
    image: "https://assets.coingecko.com/coins/images/975/large/cardano.png",
  },
  {
    assetSymbol: "XRP",
    assetName: "Ripple",
    description: "Digital payment network and protocol",
    image: "https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png",
  },
  {
    assetSymbol: "DOT",
    assetName: "Polkadot",
    description: "Multi-chain interoperability protocol",
    image: "https://assets.coingecko.com/coins/images/12171/large/polkadot.png",
  },
  {
    assetSymbol: "MATIC",
    assetName: "Polygon",
    description: "Ethereum scaling solution",
    image: "https://assets.coingecko.com/coins/images/4713/large/matic-token-icon.png",
  },
  {
    assetSymbol: "LINK",
    assetName: "Chainlink",
    description: "Decentralized oracle network",
    image: "https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png",
  },
  {
    assetSymbol: "AVAX",
    assetName: "Avalanche",
    description: "Smart contracts platform",
    image: "https://assets.coingecko.com/coins/images/12559/large/Avalanche_Circle_RedWhite_Trans.png",
  },
  {
    assetSymbol: "USDT",
    assetName: "Tether",
    description: "USD-pegged stablecoin",
    image: "https://assets.coingecko.com/coins/images/325/large/Tether.png",
  },
  {
    assetSymbol: "USDC",
    assetName: "USD Coin",
    description: "USD-backed stablecoin",
    image: "https://assets.coingecko.com/coins/images/6319/large/usdc.png",
  },
  {
    assetSymbol: "BNB",
    assetName: "BNB",
    description: "Binance ecosystem token",
    image: "https://assets.coingecko.com/coins/images/825/large/bnb-icon2_2x.png",
  },
  {
    assetSymbol: "LTC",
    assetName: "Litecoin",
    description: "Peer-to-peer cryptocurrency",
    image: "https://assets.coingecko.com/coins/images/2/large/litecoin.png",
  },
  {
    assetSymbol: "ATOM",
    assetName: "Cosmos",
    description: "Internet of Blockchains",
    image: "https://assets.coingecko.com/coins/images/1481/large/cosmos_hub.png",
  },
];

export default cryptoAssets;
