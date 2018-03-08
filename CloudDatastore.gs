/*
   Apps Script: Accessing Google Cloud Datastore under a Service Account
   @author Martin Zeitler, https://plus.google.com/106963082057954766426
   @bitcoin 19uySyXrtqQ71PFZWHb2PxBwtNitg2Dp6b
*/

/* Service Account configuration file on Google Drive */
var CONFIG = "serviceaccount.json";

/* API wrapper */
var gds = {
  
  debug:         false,
  scopes:        "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/drive",
  baseUrl:       "https://datastore.googleapis.com/v1",
  transactionId: false,
  url:           false,
  oauth:         false,
  projectId:     false,
  clientId:      false,
  clientEmail:   false,
  privateKey:    false,
  
  /* returns an instance */
  getInstance: function() {
    
    /* configure the client on demand */
    if(!this.config) {this.getConfig(CONFIG);}
    
    /* authenticate the client on demand */
    if(!this.oauth) {this.createService();}
    
    return this;
  },
  
  /* loads the configuration file from Google Drive */
  getConfig: function(filename) {
    var it = DriveApp.getFilesByName(filename);
    while (it.hasNext()) {
      var file = it.next();
      var data = JSON.parse(file.getAs("application/json").getDataAsString());
      this.projectId   = data.project_id;
      this.privateKey  = data.private_key;
      this.clientEmail = data.client_email;
      this.clientId    = data.client_id;
      continue;
    }
  },
  
  /* creates the oAuth2 service */
  createService: function() {
    this.oauth = OAuth2.createService("Datastore")
    .setTokenUrl("https://www.googleapis.com/oauth2/v4/token")
    .setPropertyStore(PropertiesService.getScriptProperties())
    // .setSubject(Session.getActiveUser().getEmail())
    .setPrivateKey(this.privateKey)
    .setIssuer(this.clientEmail)
    .setScope(this.scopes);
  },
  
  /**
   * Queries for entities.
   * @param payload ~ partitionId, readOptions, query, gqlQuery
  **/
  runQuery: function(payload) {return this.request("runQuery", payload, false);},
  
  /**
   * Begins a new transaction.
   * @param payload ~ transactionOptions
  **/
  beginTransaction: function(payload) {return this.request("beginTransaction", payload, false);},
  
  /**
   * Commits a transaction, optionally creating, deleting or modifying some entities.
   * @param payload ~ mode, mutations, transaction
  **/
  commit: function(payload) {return this.request("commit", payload, false);},
  
  /**
   * Rolls back a transaction.
   * @param payload ~ transaction
  **/
  rollback: function(payload) {return this.request("rollback", payload, false);},
  
  /**
   * Allocates IDs for the given keys, which is useful for referencing an entity before it is inserted.
   * @param keys
  **/
  allocateIds: function(keys) {return this.request("allocateIds", false, keys);},
  
  /**
   * Prevents the supplied keys' IDs from being auto-allocated by Cloud Datastore.
   * @param keys
  **/
  reserveIds: function(keys) {return this.request("reserveIds", false, keys);},
  
  /**
   * Looks up entities by key.
   * @param keys
  **/
  lookup: function(keys) {return this.request("lookup", false, keys);},
   
  /* API wrapper */
  request: function(method, payload, keys) {

    if (this.oauth.hasAccess()) {

      /* configuring the request */
      var options = this.getOptions();
      if(typeof(payload) != "undefined" && payload !== false) {options.payload = JSON.stringify(payload);}
      if(typeof(keys) != "undefined" && keys !== false) {options.keys = keys;}
      this.setUrl(method);
      
      /* the individual api methods can be handled here */
      switch(method) {
        
        /* projects.runQuery */
        case "runQuery":
          this.log(method + " > " + options.payload);
          break;
          
        /* projects.beginTransaction */
        case "beginTransaction":
          this.log(method + " > " + options.payload);
          break;
        
        /* projects.commit */
        case "commit":
          if(! this.transactionId){
            this.log("cannot commit() while there is no ongoing transaction.");
            return false;
          } else {
            payload.transaction = this.transactionId;
            this.log(method + " > " + options.payload);
          }
          break;
        
        /* projects.rollback */
        case "rollback":
          if(! this.transactionId){
            this.log("cannot rollback() while there is no ongoing transaction.");
            return false;
          } else {
            payload.transaction = this.transactionId;
            this.log(method + " > " + options.payload);
          }
          break;
        
        /* projects.allocateIds */
        case "allocateIds":
        
        /* projects.reserveIds */
        case "reserveIds":
        
        /* projects.lookup */
        case "lookup":
          this.log(method + " > " + options.keys.join(", "));
          break;
        
        default:
          this.log("invalid api method: "+ method);
          return false;
      }
      
      /* execute the request */
      Logger.log(this.url);
      var response = UrlFetchApp.fetch(this.url, options);
      var result = JSON.parse(response.getContentText());
      this.handleResult(method, result);
      
      /* it returns the actual result of the request */
      return result;
      
    } else {
      this.log(this.oauth.getLastError());
      return false;
    }
  },
  
  /* handles the result */
  handleResult: function(method, result) {
    
    /* the individual api responses can be handled here */
    switch(method){
        
      /* projects.runQuery */
      case "runQuery":
        if(typeof(result.batch) !== "undefined") {
          for(i=0; i < result.batch['entityResults'].length; i++) {
            this.log(JSON.stringify(result.batch['entityResults'][i]));
          }
        }
        break;
      
      /* projects.beginTransaction */
      case "beginTransaction":
        if(typeof(result.transaction) !== "undefined" && result.transaction != "") {
          this.log(method + " > " + result.transaction);
          this.transactionId = result.transaction;
        }
        break;
      
      /* projects.commit */
      case "commit":
        if(typeof(result.error) !== "undefined") {
          
          /* TODO: better roll back the tranction. */
          // this.transactionId = false;
          
        } else {
          if(typeof(result.mutationResults) !== "undefined") {
            for(i=0; i < result.mutationResults.length; i++) {
              this.log(JSON.stringify(result.mutationResults[i]));
            }
          }
        }
        break;
      
      /* projects.rollback */
      case "rollback":
        break;
      
      /* projects.allocateIds */
      case "allocateIds":
        break;
      
      /* projects.reserveIds */
      case "reserveIds":
        break;
      
      /* projects.lookup */
      case "lookup":
        break;
    }
    
    /* always log these errors */
    if(typeof(result.error) !== "undefined") {
      Logger.log(method + " > error " + result.error.code + ": " + result.error.message);
    }
  },
  
  /* sets the request url per method */
  setUrl: function(method){
      this.url = this.baseUrl + "/projects/" + this.projectId + ":" + method;
  },
  
  /* gets the request options */
  getOptions: function() {
    if (this.oauth.hasAccess()) {
      return {
        method: "POST",
        headers: {Authorization: 'Bearer ' + this.oauth.getAccessToken()},
        contentType: "application/json",
        muteHttpExceptions: true
      };
    }
  },
  
  /* logs while this.debug is true */
  log: function(message){
    if(this.debug) {Logger.log(message);}
  },
  
  randomString: function() {
    var result = "";
    while (result == "") {result = Math.random().toString(36).substr(2, 5);}
    return result;
  },
  
  /* resets the authorization state */
  resetAuth: function() {
    this.oauth.reset();
  },
  
  /* queries for entities by the name of their kind */
  queryByKind: function(name) {
    return this.runQuery({query: {kind:[{name: name}]}});
  },
  
  /* deletes an entity by the name of it's kind and it's id */
  deleteByKindAndId: function(name, id) {
    this.beginTransaction({});
    this.commit({
      "transaction": this.transactionId,
      "mutations": {
        "delete": {
          "partitionId": {"projectId": this.projectId},
          "path": [{"kind": name, "id": id}]
        }
      }
    });
  }
};



/* Test: queries for entities of kind `strings` */
function queryByKind() {
  var ds = gds.getInstance();
  var result = ds.queryByKind("strings");
  if(typeof(result.batch) !== "undefined") {
    for(i=0; i < result.batch['entityResults'].length; i++) {
      Logger.log(JSON.stringify(result.batch['entityResults'][i]));
    }
  }
}

/* Test: deletes an entity of kind `strings` with id */
function deleteByKindAndId() {
  var ds = gds.getInstance();
  ds.deleteByKindAndId("strings", "4957293397409792");
}

/* Test: inserts an entity */
function insertEntity() {

  /* inserts an entity of kind `strings` with a random string as property `name` */
  var ds = gds.getInstance();
  ds.beginTransaction({});
  ds.commit({
    "transaction": ds.transactionId,
    "mutations": {
      "insert": {
        "key": {
          "partitionId": {"projectId": ds.projectId},
          "path": [{"kind": "strings"}]
        },
        "properties":{
          "name": {"stringValue": ds.randomString()}
        }
      }
    }
  });
}

/* Test: updates an entity */
function updateEntity() {
   
  var id = "4957293397409792";
   
  /* it selects of an entity of kind `strings` by it's id and updates it's property `name` with a random string */
  var ds = gds.getInstance();
  ds.beginTransaction({});
  ds.commit({
    "transaction": ds.transactionId,
    "mutations": {
      "update": {
        "key": {
          "partitionId": {"projectId": ds.projectId},
          "path": [{"kind": "strings", "id": id}]
        },
        "properties":{
          "name": {"stringValue": ds.randomString()}
        }
      }
    }
  });
}

/* Test: upserts an entity */
function upsertEntity() {
   
  var id = "4957293397409792";

  /* it selects of an entity of kind `strings` by it's id and updates it's property `name` with a random string */
  var ds = gds.getInstance();
  ds.beginTransaction({});
  ds.commit({
    "transaction": ds.transactionId,
    "mutations": {
      "upsert": {
        "key": {
          "partitionId": {"projectId": ds.projectId},
          "path": [{"kind": "strings", "id": id}]
        },
        "properties":{
          "name": {"stringValue": ds.randomString()}
        }
      }
    }
  });
}
