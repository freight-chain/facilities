var Token = artifacts.require("./BAMTokenContract.sol");
var DummyERC20Token = artifacts.require("./DummyERC20Token.sol");
var Sale = artifacts.require("./BAMSaleContract.sol");

module.exports = function(deployer) {

  var tokenInstance;
  var erc20Instance;
  var saleInstance;

  var admin = "0x539ba3a966c7ee2b6954763d6c1d4e1f45da21c8";
  var name = "BAM Token";
  var symbol = "BAM";
  return Token.new(name, symbol).then(function(instance){
    console.log("Token contract created " + instance.address);
    tokenInstance = instance;
    return tokenInstance;
  })
  .then(function(){
    return DummyERC20Token.new().then(function(instance){
      console.log("DummyERC20Token contract created " + instance.address);
      erc20Instance = instance;
      return erc20Instance;
    });
  })
  .then(function(){
    return Sale.new(tokenInstance.address, erc20Instance.address, admin).then(function(instance){
      console.log("Sale contract created " + instance.address);
      saleInstance = instance;
      return saleInstance;
    });
  })
  .then(function(){
    return tokenInstance.setTokenSaleAddress(saleInstance.address).then(function(){
      console.log("Token contract initialized successfully");
    })
  });
};
