# Probo Asset Receiver
[![Build Status](https://travis-ci.org/ProboCI/probo-asset-receiver.svg?branch=master)](https://travis-ci.org/ProboCI/probo-asset-receiver)
[![Coverage Status](https://coveralls.io/repos/ProboCI/probo-asset-receiver/badge.svg?branch=master&service=github)](https://coveralls.io/github/ProboCI/probo-asset-receiver?branch=master)

Allows the upload of an asset 

This project is designed to be used in conjunction with the corresponding CLI client
([probo-uploader](https://github.com/ProboCI/probo-uploader)) to allow you to upload
assets for use in probo builds. 

## Authentication

Token-based authentication can be enabled for all APIs except file upload. To enable it, add at least one token in the config file:

```yaml
tokens:
  - token1
  - token2
```

To authenticate API calls use a bearer-token authentication header: `Authentication: Bearer token1`

```
curl -H "Authentication: Bearer token1" http://localhost:3000/buckets/foo
```



## Usage

 1. Add Amazon S3 credentials.
 2. Create a bucket to hold assets.
 3. Create a token that can be used to post assets into that bucket.
 4. Upload an asset into a bucket with the upload token.

### 1. Add Amazon S3 credentials defaults.config.yaml
Replace the following with [Amazon S3 storage credentials](http://docs.aws.amazon.com/general/latest/gr/aws-security-credentials.html). 
   * awsAccessKeyId: 'AWS Access Key Id'
   * awsSecretAccessKey: 'AWS Secret Access Key'  

### 2. Create a bucket

The following will create a bucket called `foo` and store the associated metadata key `some` with value `metadata`.

```` bash
curl -XPOST -H "Content-Type: application/json" -i -d '{"some":"metadata"}' http://localhost:3000/buckets/foo
````

### 3. Create a token that can be used to post assets into that bucket

In order to upload assets to a bucket, you'll need an upload token. This is a shared secret (essentially like an API key)
that allows you to upload assets to a particular bucket.  You can create any number of these tokens per bucket and in

```` bash
curl -i -XPOST http://localhost:3000/buckets/foo/token/bar
````

To delete a token:

```` bash
curl -i -XDELETE http://localhost:3000/buckets/foo/token/bar
````

### 4. Use the super secret token to upload a file

The following curl command will upload our database.sql.gz file as raw binary data and name the asset
baz for later reference.

```` bash
curl -i -XPOST --data-binary @database.sql.gz http://localhost:3000/asset/bar/baz
````

### 5. Download the file that you uploaded

```` bash
curl -i http://localhost:3000/asset/bar/baz > baz
````
