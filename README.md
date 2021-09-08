# Probo Asset Receiver

Allows the upload of an asset to a Probo asset storage system. These assets are items such as databases, secrets configurations or other files that are used in conjunction with the Probo build service and specified as an [asset](https://docs.probo.ci/build/assets/).

This project is designed to be used in conjunction with the corresponding CLI client ([probo-uploader](https://github.com/ProboCI/probo-uploader)) to allow you to upload assets for use in Probo builds as well as the Probo [container service](https://docs.probo.ci/build/configuration/) to load assets into your Probo builds.

Because the Probo service will need to be able to access files in the asset receiver, it should be configured with a fully qualified domain or subdomain name so that it can be publicly accessed from inside Docker containers. See **#8** below for additional info.

## Authentication

Token-based authentication can be enabled for all APIs except file upload. To enable it, add at least one token in the config file:

```yaml
tokens:
  - token_value
```

To authenticate API calls use a bearer-token authentication header: `Authentication: Bearer token_value`. It is recommended to use a bearer-token for any production-level system.

```
curl -H "Authentication: Bearer token_value" http://localhost:3000/buckets/foo
```

## Usage

1.  Create a bucket to hold assets.
2.  Create a token that can be used to post assets into that bucket.
3.  Upload an asset into a bucket with the upload token.
4.  Retrieve files from asset receiver.

* * *

### 1\. Create a bucket

The following will create a bucket called `foo` and store the associated metadata key `some` with value `metadata`.

```bash
curl -XPOST -H "Content-Type: application/json" -i -d '{"some":"metadata"}' http://localhost:3000/buckets/foo
```

* * *

### 2\. Create a token that can be used to post assets into that bucket

In order to upload assets to a bucket, you'll need an upload token. This is a shared secret (essentially like an API key) that allows you to upload assets to a particular bucket. You can create any number of these tokens per bucket and in

```bash
curl -i -XPOST http://localhost:3000/buckets/<bucket_name>/token/<token_value>
```

To delete a token:

```bash
curl -i -XDELETE http://localhost:3000/buckets/<bucket_name>/token/<token_value>
```

* * *

### 3\. Use the super secret token to upload a file

The following curl command will upload our database.sql.gz file as raw binary data. Replace &lt;token\_value&gt; with your created token and &lt;asset\_name&gt; with the name of the asset for later reference.

```bash
curl -i -XPOST --data-binary @database.sql.gz http://localhost:3000/asset/<token_value>/<asset_name>
```

* * *

### 4\. Download the file that you uploaded

```bash
curl -i http://localhost:3000/asset/<bucket_name>/<asset_name> > <file_name>
```

* * *

### 5\. Using Amazon S3 to storage your assets

You can use [Amazon S3 storage](https://aws.amazon.com/s3/) to store your assets by using the AwsS3Storage Plugin. There is an example of this in the `defaults.yaml` file in this repository. You will need to provide your own access keys and bucket name from your Amazon account. You must then move your config file outside of the git repo or add it to your .gitignore file. **Failing to do this step will guarantee you a bad time.** You can then use the config argument `-c` to tell the Probo Asset Reciever to override the defaults.yaml file with your own configuration file.

Example:

```
./bin/probo-asset-receiver -c /path/to/config-file/custom.yaml
```

* * *

### 6\. Pausing and unpausing file uploads

If doing server maintenance, it is often nice to be able to prevent new files
from coming in but still allowing existing files to be served. This allows
builds to continue to function even though new assets will not be allowed. This
is helpful when migrating the files to a new server or system.

```
curl -X POST -H "Authorization: Bearer" -H content-type:application/json --data-binary '{"uploadsPaused": true}' http://localhost:3000/service/upload-status
```

* * *

### 7\. Docker

The Dockerfile included is everything you need to build and run the service. To compile a container use the following command

`docker build . -t probo/asset-receiver`

This will build and create the container.

You can then run the container, but it is more recommended to use a docker-compose.yml file as follows:

```yaml
version: '3'
services:
  probo-asset-receiver:
    image: proboci/probo-asset-receiver:latest
    container_name: asset-receiver
    volumes:
      - ./probo-config:/etc/probo
      - ./proboci/probo-asset-receiver/db:/opt/db
    network_mode: host
    restart: always
```

Note that any custom configuration.yaml files should go in the `./probo-config/` folder. An example configuration is as follows, but also be sure

```yaml
host: 0.0.0.0
port: 3070

# The directory in which to store the LevelDB database.
databasePlugin: LevelDB
databaseConfig:
  databaseDataDirectory: /real/path/to/proboci/probo-asset-receiver/db

# Determines the cipher used to encrypt the assets.
# See https://www.openssl.org/docs/manmaster/apps/ciphers.html for options.
encryptionCipher: 'aes-256-cbc'
encryptionPassword: SECRET

# If using S3 use this template for config settings.
fileStoragePlugin: AwsS3Storage
fileStorageConfig:
  awsAccessKeyId: <KeyID>
  awsSecretAccessKey: <AccessKey>
  awsBucket: <bucket>
```

### 8\. Fully Qualified Domain Name

Because your Probo containers will need to be able to publicly access these files, it is recommended that your asset receiver be available on an open port. To secure this, it is STRONGLY RECOMMENDED you use a bearer token to access the asset receiver. You can read more about this in **#2** above.

You can then replace the "localhost" reference in your url with your domain name. So if your domain was "assets.example.com" you could use:

```
curl -i -XDELETE http://assets.example.com:3000/buckets/<bucket_name>/token/<token_value>
```

Be sure to read the [Nginx Proxy](https://docs.probo.ci/open-source/nginx) instructions for using a reverse proxy to channel things through port 80 or 443 on your web service.
