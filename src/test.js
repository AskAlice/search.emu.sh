const topcap = require("../topcap.json");
const coinlist = require("../allcoins.json");
const fs = require("fs");
const assets = [];
const assetObj = {};
let count = 0;
for (const [key, value] of Object.entries(coinlist.Data)) {
  count++;
  if (topcap.includes(value.Name)) {
    const picked = (({ ImageUrl, CoinName, Symbol, Url, Description }) => ({ image: ImageUrl, assetName: CoinName, assetSymbol: Symbol, url: Url, description: Description }))(value);
    picked.image = `https://cryptocompare.com${picked.image}`;
    picked.url = `https://cryptocompare.com${picked.url}`;
    assetObj[picked.assetSymbol] = picked;
    assets.push(picked);
  }
}
// assets = assets.filter((asset) => asset.SortOrder < 500);
// console.log(assets.length);
// console.log(JSON.stringify(assetObj));
fs.writeFile("./coinData.json", JSON.stringify(assets), "utf8", (err) => {
  if (err) {
    console.error(err);
    return;
  }
});
// console.log(assets);
