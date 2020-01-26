var Token = artifacts.require("./BAMTokenContract.sol");
var Sale = artifacts.require('./BAMSaleContract.sol');
var ARYToken = artifacts.require('./DummyERC20Token.sol');
var BigNumber = require('bignumber.js');

////////////////////////////////////////////////////////////////////////////////

var tokenContract;
var contractOwner;
var saleInstance;
var erc20Instance;

var totalSupply = new BigNumber(0);
var maxAllowedWhitelistedAddresses = 5;
var tokensByOwner = {};
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

  it("deploy token and init accounts", function() {
    contractOwner = accounts[0];
    var tokenName = "TestToken";
    var tokenSymbol = "TTN";

    return Token.new(tokenName, tokenSymbol, {from: contractOwner}).then(function(result){
      tokenContract = result;
        
      // check total supply
      return tokenContract.totalSupply();        
    }).then(function(result){
      // Should have 0 tokens on deployment
      assert.equal(result.valueOf(), totalSupply.valueOf(), "unexpected total supply");
    })
    .then(function(){
      return ARYToken.new({from: accounts[1]}).then(function(instance){
        erc20Instance = instance;
        return erc20Instance;
      });
    })
    .then(function(){
      return Sale.new(tokenContract.address, erc20Instance.address, contractOwner).then(function(instance){
        saleInstance = instance;
        return saleInstance;
      });
    })
    .then(function(){
      return tokenContract.setTokenSaleAddress(saleInstance.address).then(function(){
        return tokenContract.getTokenSaleAddress()
      })
    })
    .then(function(result){
      assert.equal(result, saleInstance.address, "sale address not set");
    })
  });

  it("should let owner mint a token", function() {
    var assignee = accounts[1];
    var expectedBalance = new BigNumber(1);
    var newTotalSupply = totalSupply.plus(new BigNumber(1));
    var tokenId;
    return tokenContract.mint(assignee, "1234", [], {from: contractOwner}).then(function(result){        
      // check balance of _assignee
      assert.equal(result.logs.length, 2, "did not emit proper events");
      tokenId = result.logs[0].args._tokenId.valueOf()
      tokensByOwner[tokenId] = assignee;
      return tokenContract.balanceOf(assignee);        
    })
    .then(function(result){
      // Should have 0 tokens on deployment
      assert.equal(result.valueOf(), expectedBalance.valueOf(), "unexpected assignee balance");
      return tokenContract.ownerOf(tokenId);
    })
    .then(function(result){
      // Should have 0 tokens on deployment
      assert.equal(result, assignee, "unexpected owner address");
      return tokenContract.totalSupply();
    })
    .then(function(result){
      assert.equal(result.valueOf(), newTotalSupply.valueOf(), "unexpected total supply");
    })
  });

  it("should not let non-owner mint a token", function() {
    var assignee = accounts[1];
    return tokenContract.mint(assignee, "1234", [], {from: accounts[2]}).then(function(result){        
      assert.fail("only admin can mint a token");
    })
    .catch(function(error){
      assert( throwErrorMessage(error), "expected throw got " + error);    
    });
  })

  it("should let token-owner add a whitelisted address", function() {
    var tokenId = Object.keys(tokensByOwner)[0];
    var tokenOwner = tokensByOwner[tokenId];
    var whitelistedAddress = accounts[2];

    return saleInstance.addLicenseWhitelistedAddress(tokenId, whitelistedAddress, {from: tokenOwner}).then(function(result){        
      return tokenContract.getLicenseWhitelistedAddresses(tokenId);    
    })
    .then(function(result){
      assert.isArray(result, 'unexpected whitelisted addresses format');
      assert.isAtMost(result.length, maxAllowedWhitelistedAddresses, 'whitelisted addresses exceed maxAllowedWhitelistedAddresses');
      assert.include(result, whitelistedAddress, 'whitelisted address not added');
    })
  })

  it("should let token-owner add bulk whitelisted addresses within limit", function() {
    var tokenId = Object.keys(tokensByOwner)[0];
    var tokenOwner = tokensByOwner[tokenId];
    var whitelistedAddresses = [accounts[3], accounts[4], accounts[5], accounts[6]];

    return saleInstance.addLicenseWhitelistedAddressBulk(tokenId, whitelistedAddresses, {from: tokenOwner}).then(function(result){        
      return tokenContract.getLicenseWhitelistedAddresses(tokenId);    
    })
    .then(function(result){
      assert.isArray(result, 'unexpected whitelisted addresses format');
      assert.isAtMost(result.length, maxAllowedWhitelistedAddresses, 'whitelisted addresses exceed maxAllowedWhitelistedAddresses');
      assert.includeMembers(result, whitelistedAddresses, 'whitelisted addresses not added');
    })
  })

  it("should not let token-owner exceed whitelisted addresses limit", function() {
    var tokenId = Object.keys(tokensByOwner)[0];
    var tokenOwner = tokensByOwner[tokenId];
    var whitelistedAddress = accounts[7];

    return saleInstance.addLicenseWhitelistedAddress(tokenId, whitelistedAddress, {from: tokenOwner}).then(function(result){        
      assert.fail("maxAllowedWhitelistedAddresses limit exceeded")
      return tokenContract.getLicenseWhitelistedAddresses(tokenId);    
    })
    .catch(function(error){
      assert( throwErrorMessage(error), "expected throw got " + error); 
    })
    .then(function(){
      return tokenContract.getLicenseWhitelistedAddresses(tokenId);
    })
    .then(function(result){
      assert.isArray(result, 'unexpected whitelisted addresses format');
      assert.isAtMost(result.length, maxAllowedWhitelistedAddresses, 'whitelisted addresses exceed maxAllowedWhitelistedAddresses');
      assert.notInclude(result, whitelistedAddress, 'whitelisted address should not be added');
    })
  })

  it("should let token-owner remove a whitelisted address", function() {
    var tokenId = Object.keys(tokensByOwner)[0];
    var tokenOwner = tokensByOwner[tokenId];
    var whitelistedAddress = accounts[2];

    return saleInstance.removeLicenseWhitelistedAddress(tokenId, whitelistedAddress, {from: tokenOwner}).then(function(result){        
      return tokenContract.getLicenseWhitelistedAddresses(tokenId);    
    })
    .then(function(result){
      assert.isArray(result, 'unexpected whitelisted addresses format');
      assert.isAtMost(result.length, maxAllowedWhitelistedAddresses, 'whitelisted addresses exceed maxAllowedWhitelistedAddresses');
      assert.notInclude(result, whitelistedAddress, 'whitelisted address not removed');
    })
  })

  it("should let token-owner remove bulk whitelisted addresses", function() {
    var tokenId = Object.keys(tokensByOwner)[0];
    var tokenOwner = tokensByOwner[tokenId];
    var whitelistedAddresses = [accounts[3], accounts[4]];
    return saleInstance.removeLicenseWhitelistedAddressBulk(tokenId, whitelistedAddresses, {from: tokenOwner}).then(function(result){        
      return tokenContract.getLicenseWhitelistedAddresses(tokenId);    
    })
    .then(function(result){
      assert.isArray(result, 'unexpected whitelisted addresses format');
      assert.isAtMost(result.length, maxAllowedWhitelistedAddresses, 'whitelisted addresses exceed maxAllowedWhitelistedAddresses');
      assert.notIncludeMembers(result, whitelistedAddresses, 'whitelisted addresses not removed');
    })
  })

  it("should not let non-token-owner add a whitelisted address", function() {
    var tokenId = Object.keys(tokensByOwner)[0];
    var tokenOwner = accounts[3];
    var whitelistedAddress = accounts[2];

    return saleInstance.addLicenseWhitelistedAddress(tokenId, whitelistedAddress, {from: tokenOwner}).then(function(result){        
      assert.fail("Non token-owner should not modify token addresses")
      return tokenContract.getLicenseWhitelistedAddresses(tokenId);    
    })
    .catch(function(error){
      assert( throwErrorMessage(error), "expected throw got " + error); 
    })
    .then(function(){
      return tokenContract.getLicenseWhitelistedAddresses(tokenId);
    })
    .then(function(result){
      assert.isArray(result, 'unexpected whitelisted addresses format');
      assert.isAtMost(result.length, maxAllowedWhitelistedAddresses, 'whitelisted addresses exceed maxAllowedWhitelistedAddresses');
      assert.notInclude(result, whitelistedAddress, 'whitelisted address should not be added');
    })
  })

  it("should not let non-token-owner add bulk whitelisted addresses", function() {
    var tokenId = Object.keys(tokensByOwner)[0];
    var tokenOwner = accounts[3];
    var whitelistedAddresses = [accounts[3], accounts[4]];

    return saleInstance.addLicenseWhitelistedAddressBulk(tokenId, whitelistedAddresses, {from: tokenOwner}).then(function(result){        
      assert.fail("Non token-owner should not modify token addresses")
    })
    .catch(function(error){
      assert( throwErrorMessage(error), "expected throw got " + error); 
    })
    .then(function(){
      return tokenContract.getLicenseWhitelistedAddresses(tokenId);
    })
    .then(function(result){
      assert.isArray(result, 'unexpected whitelisted addresses format');
      assert.isAtMost(result.length, maxAllowedWhitelistedAddresses, 'whitelisted addresses exceed maxAllowedWhitelistedAddresses');
      assert.notIncludeMembers(result, whitelistedAddresses, 'whitelisted addresses should not be added');
    })
  })

  it("should not let non-token-owner remove a whitelisted address", function() {
    var tokenId = Object.keys(tokensByOwner)[0];
    var tokenOwner = accounts[3];
    var whitelistedAddress = accounts[2];

    return saleInstance.removeLicenseWhitelistedAddress(tokenId, whitelistedAddress, {from: tokenOwner}).then(function(result){        
      assert.fail("Non token-owner should not modify token addresses")    
    })
    .catch(function(error){
      assert( throwErrorMessage(error), "expected throw got " + error); 
    })
  })

  it("should not let non-token-owner remove bulk whitelisted addresses", function() {
    var tokenId = Object.keys(tokensByOwner)[0];
    var tokenOwner = accounts[3];
    var whitelistedAddresses = [accounts[3], accounts[4]];

    return saleInstance.removeLicenseWhitelistedAddressBulk(tokenId, whitelistedAddresses, {from: tokenOwner}).then(function(result){        
      assert.fail("Non token-owner should not modify token addresses")    
    })
    .catch(function(error){
      assert( throwErrorMessage(error), "expected throw got " + error); 
    })
  })
});



