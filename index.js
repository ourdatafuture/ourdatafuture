'use strict';
const pulumi = require('@pulumi/pulumi');
const gcp = require('@pulumi/gcp');
const mime = require('mime');

// Create a storage bucket
let webBucket = new gcp.storage.Bucket('www', {
  website: {
    mainPageSuffix: 'index.html',
  },
  uniformBucketLevelAccess: true,
});

// Allow the contents of this bucket to be viewed anonymously over the Internet
const bucketIAMBinding = new gcp.storage.BucketIAMBinding('www-IAMBinding', {
  bucket: webBucket.name,
  role: 'roles/storage.objectViewer',
  members: ['allUsers'],
});

// Upload final website distribution files
let siteDir = 'dist';
let index = null;

// For each file in the directory, create an object stored in `siteBucket`
for (let item of require('fs').readdirSync(siteDir)) {
  let filePath = require('path').join(siteDir, item);
  let object = new gcp.storage.BucketObject(item, {
    bucket: webBucket,
    name: item,
    source: new pulumi.asset.FileAsset(filePath),
    contentType: mime.getType(filePath) || undefined,
  });
  // Capture the index.html file, we need to reference it later
  if (item.endsWith('index.html')) {
    index = object;
  }
}

exports.webBucket = webBucket.name;
exports.webBucketEndpoint = pulumi.concat(
  'http://storage.googleapis.com/',
  webBucket.name,
  '/',
  index.name
);
