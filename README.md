# Probo Asset Receiver
[![Build Status](https://travis-ci.org/ProboCI/probo-asset-receiver.svg?branch=master)](https://travis-ci.org/ProboCI/probo-asset-receiver)

Allows the upload of an asset 

This project is designed to be used in conjunction with the corresponding CLI client
([probo-uploader](https://github.com/ProboCI/probo-uploader)) to allow you to upload
assets for use in probo builds. 


## Usage

 1. Create a bucket to hold assets.
 2. Create a token that can be used to post assets into that bucket.
 3. Upload an asset into a bucket with the upload token.


### 1. Create a bucket

The following will create a bucket called `foo` and store the associated metadata key `some` with value `metadata`.

```` bash
curl -XPOST -H "Content-Type: application/json" -i -d '{"some":"metadata"}' http://localhost:3000/buckets/foo
````

### 2. Create a token that can be used to post assets into that bucket

In order to upload assets to a bucket, you'll need an upload token. This is a shared secret (essentially like an API key)
that allows you to upload assets to a particular bucket.  You can create any number of these tokens per bucket and in
the event that one is compromised you can easily delete the token.

```` bash
curl -i -XPOST http://localhost:3000/buckets/foo/token/bar
````


### 3. Use the super secret token to upload a file

The following curl command will upload our database.sql.gz file as raw binary data and name the asset
baz for later reference.

```` bash
curl -i -XPOST --data-binary @database.sql.gz http://localhost:3000/asset/bar/baz
````

### 4. Download the file that you uploaded

```` bash
curl -i http://localhost:3000/asset/bar/baz > baz
````
