var Token = artifacts.require("./BAMTokenContract.sol");
var ARYToken = artifacts.require('./DummyERC20Token.sol');
var Sale = artifacts.require('./BAMSaleContract.sol');

var BigNumber = require('bignumber.js');

////////////////////////////////////////////////////////////////////////////////

var tokenInstance;
var saleInstance;
var erc20Instance;

var contractOwner;
var buyerAccount;

var aryPerToken = 1 * Math.pow(10, 18);
var tokensByOwner = {};
var companyId = "1234";
////////////////////////////////////////////////////////////////////////////////

function throwErrorMessage( error ) {
    if( error.message.search('invalid opcode') >= 0 ) return true;
    if( error.message.search('out of gas') >= 0 ) return true;   
    if( error.message.search('revert') >= 0) return true; 
    if( error.message.search('sender doesn\'t have enough funds to send tx') >= 0) return true;
    return false;    
};

contract('token contract', function(accounts) {

  beforeEach(function(done){
    done();
  });
  afterEach(function(done){
    done();
  });

  it("deploy sale contract and set sale address in token contract", function() {
    contractOwner = accounts[0];
    var tokenName = "TestToken";
    var tokenSymbol = "TTN";

    return Token.new(tokenName, tokenSymbol).then(function(instance){
      tokenInstance = instance;
      return tokenInstance;
    })
    .then(function(){
      return ARYToken.new({from: accounts[1]}).then(function(instance){
        erc20Instance = instance;
        return erc20Instance;
      });
    })
    .then(function(){
      return Sale.new(tokenInstance.address, erc20Instance.address, contractOwner).then(function(instance){
        saleInstance = instance;
        return saleInstance;
      });
    })
    .then(function(){
      return tokenInstance.setTokenSaleAddress(saleInstance.address).then(function(){
        return tokenInstance.getTokenSaleAddress()
      })
    })
    .then(function(result){
      assert.equal(result, saleInstance.address, "sale address not set");
    })
  });

  it("should not purchase without payment allowance", function() {
    var whitelistedAddress = [accounts[2], accounts[3]];
    buyerAccount = accounts[1];
    return saleInstance.purchase(companyId, whitelistedAddress, buyerAccount, {from: buyerAccount}).then(function(){
      assert.fail("should not be able to create token without allowance")    
    })
    .catch(function(error){
      assert( throwErrorMessage(error), "expected throw got " + error); 
    })
  });

  it("should purchase with default token price", function() {
    var whitelistedAddresses = [accounts[2], accounts[3]];
    var previousBuyerBalance;
    var previousBeneficiaryBalance;

    var expectedBalance = new BigNumber(1);
    buyerAccount = accounts[1];

    return erc20Instance.approve(saleInstance.address, aryPerToken, {from: buyerAccount})
    .then(function(){
      return erc20Instance.allowance(buyerAccount, saleInstance.address);
    })
    .then(function(result){
      assert.equal(result.valueOf(), aryPerToken, "unexpected allowance");
    })
    .then(function(){
      return erc20Instance.balanceOf(buyerAccount).then(function(result){
        previousBuyerBalance = result;
        return previousBuyerBalance;
      });
    })
    .then(function(){
      return erc20Instance.balanceOf(contractOwner).then(function(result){
        previousBeneficiaryBalance = result;
        return previousBeneficiaryBalance;
      });
    })
    .then(function(){
      return saleInstance.purchase(companyId, whitelistedAddresses, buyerAccount, {from: buyerAccount});
    })
    .then(function(){
      return erc20Instance.balanceOf(buyerAccount).then(function(result){
        assert.equal(result.valueOf(), previousBuyerBalance.minus(aryPerToken).valueOf(), "ary token transfer failed");
      });
    })
    .then(function(){
      return erc20Instance.balanceOf(contractOwner).then(function(result){
        assert.equal(result.valueOf(), previousBeneficiaryBalance.plus(aryPerToken).valueOf(), "ary token transfer failed");
      });
    })
    .then(function(){
      return tokenInstance.balanceOf(buyerAccount);        
    })
    .then(function(result){
      assert.equal(result.valueOf(), expectedBalance.valueOf(), "unexpected assignee balance");
    })
  });

  it("should not allow non-owner to update token price", function() {
    var newAryPrice = 10;

    return saleInstance.setARYPerToken(newAryPrice, {from: accounts[1]}).then(function(){
      assert.fail("should not allow non-owner to update token price")    
    })
    .catch(function(error){
      assert( throwErrorMessage(error), "expected throw got " + error); 
    })
    .then(function(){
      return saleInstance.getARYPerToken();        
    })
    .then(function(result){
      assert.equal(result.valueOf(), aryPerToken.valueOf(), "unexpected ary price");
    })
  });

  it("should allow owner to update token price", function() {
    var newAryPrice = new BigNumber(10);

    return saleInstance.setARYPerToken(newAryPrice.valueOf(), {from: contractOwner}).then(function(){
      return saleInstance.getARYPerToken();    
    })
    .then(function(result){
      assert.equal(result.valueOf(), newAryPrice.valueOf(), "unexpected ary price");
      aryPerToken = newAryPrice;
    })
  });

  it("should purchase with modified token price", function() {
    var whitelistedAddresses = [accounts[2], accounts[3]];
    var expectedBalance = new BigNumber(2); // Account already has a token
    var newCompanyId = "2345";
    var previousBuyerBalance;
    var previousBeneficiaryBalance;
    buyerAccount = accounts[1];

    return erc20Instance.approve(saleInstance.address, aryPerToken.valueOf(), {from: buyerAccount})
    .then(function(){
      return erc20Instance.allowance(buyerAccount, saleInstance.address);
    })
    .then(function(result){
      assert.equal(result.valueOf(), aryPerToken, "unexpected allowance");
    })
    .then(function(){
      return erc20Instance.balanceOf(buyerAccount).then(function(result){
        previousBuyerBalance = result;
        return previousBuyerBalance;
      });
    })
    .then(function(){
      return erc20Instance.balanceOf(contractOwner).then(function(result){
        previousBeneficiaryBalance = result;
        return previousBeneficiaryBalance;
      });
    })
    .then(function(){
      return saleInstance.purchase(newCompanyId, whitelistedAddresses, buyerAccount, {from: buyerAccount});
    })
    .then(function(){
      return erc20Instance.balanceOf(buyerAccount).then(function(result){
        assert.equal(result.valueOf(), previousBuyerBalance.minus(aryPerToken).valueOf(), "ary token transfer failed");
      });
    })
    .then(function(){
      return erc20Instance.balanceOf(contractOwner).then(function(result){
        assert.equal(result.valueOf(), previousBeneficiaryBalance.plus(aryPerToken).valueOf(), "ary token transfer failed");
      });
    })
    .then(function(){
      return tokenInstance.balanceOf(buyerAccount);        
    })
    .then(function(result){
      assert.equal(result.valueOf(), expectedBalance.valueOf(), "unexpected assignee balance");
    })
  });
});



