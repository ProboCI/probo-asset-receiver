# Probo Asset Receiver
[![Build Status](https://travis-ci.org/ProboCI/probo-asset-receiver.svg?branch=master)](https://travis-ci.org/ProboCI/probo-asset-receiver)
[![Coverage Status](https://coveralls.io/repos/ProboCI/probo-asset-receiver/badge.svg?branch=master&service=github)](https://coveralls.io/github/ProboCI/probo-asset-receiver?branch=master)

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

```` bash
curl -i -XPOST http://localhost:3000/buckets/foo/token/bar
````

To delete a token:

```` bash
curl -i -XDELETE http://localhost:3000/buckets/foo/token/bar
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

### 5. Using Amazon S3 to storage your assets
You can use [Amazon S3 storage](https://aws.amazon.com/s3/) to store your assets by using the AwsS3Storage Plugin. There is the example config file [`AwsS3Storage.config.yaml`](https://github.com/ProboCI/probo-asset-receiver/blob/file-storage-s3-plugin/AwsS3Storage.config.yaml) in this repository. You will need to provide your own access keys and bucket name from your Amazon account. You will want to move your config file outside of your git repo or add it to your .gitignore file. You can then use the config argument `-c` to tell the Probo Asset Reciever to override the defaults.config.yaml file with your own configuration file.
Example:
```
./bin/probo-asset-receiver -c path/to/config-file/awsS3Storage.config.yaml
```
