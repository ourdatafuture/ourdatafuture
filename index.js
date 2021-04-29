'use strict';
const pulumi = require('@pulumi/pulumi');
const gcp = require('@pulumi/gcp');
const mime = require('mime');

// Create a storage bucket
let webBucket = new gcp.storage.Bucket('www', {
  website: {
    mainPageSuffix: 'index.html',
    not_found_page: '404.html',
  },
  uniformBucketLevelAccess: true,
});

// Allow the contents of this bucket to be viewed anonymously over the Internet
const bucketIAMBinding = new gcp.storage.BucketIAMBinding('odf-storage-iam-public', {
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

exports.gcpBucketEndpoint = pulumi.concat(
  'http://storage.googleapis.com/',
  webBucket.name,
  '/',
  index.name
);

// Setup this bucket as a load balancer backend
let lbBackend = new gcp.compute.BackendBucket('odf-web-backend', {
  description: 'Serves static website assets from storage bucket',
  bucketName: webBucket.name,
  enableCdn: true,
});

// Map all URLs to this backend
let httpsUrlMap = new gcp.compute.URLMap('odf-https-lb', {
  description: 'Map all routes to the backend bucket',
  defaultService: lbBackend.id,
  hostRules: [
    {
      hosts: ['ourdatafuture.org', 'www.ourdatafuture.org'],
      pathMatcher: 'allpaths',
    },
  ],
  pathMatchers: [
    {
      name: 'allpaths',
      defaultService: lbBackend.id,
      pathRules: [
        {
          paths: ['/*'],
          service: lbBackend.id,
        },
      ],
    },
  ],
});

// Retrieve the SSL cert
let sslCert = gcp.compute.SSLCertificate.get('odf-ssl-cert', 'ourdatafuture');

// Set up the HTTPS proxy
let httpsProxy = new gcp.compute.TargetHttpsProxy('odf-https-proxy', {
  urlMap: httpsUrlMap.id,
  sslCertificates: [sslCert.id],
});

// Reserve an external IP address
let externalIP = new gcp.compute.GlobalAddress('odf-external-ip');

// Forwarding rule for External Network Load Balancing
let httpsFwdRule = new gcp.compute.GlobalForwardingRule('odf-web-forward-https', {
  portRange: '443',
  ipAddress: externalIP.address,
  target: httpsProxy.selfLink,
});

exports.ipAddress = externalIP.address;

// Redirect http to https
const httpRedirMap = new gcp.compute.URLMap('odf-http-to-https', {
  description: 'Redirect all traffic from http to https',
  defaultUrlRedirect: {
    httpsRedirect: true,
    stripQuery: false,
  },
});

// Set up the HTTPS proxy
let httpProxy = new gcp.compute.TargetHttpProxy('odf-http-proxy', {
  urlMap: httpRedirMap.id,
});

// Forwarding rule for External Network Load Balancing
let httpFwdRule = new gcp.compute.GlobalForwardingRule('odf-web-forward-http', {
  portRange: '80',
  ipAddress: externalIP.address,
  target: httpProxy.selfLink,
});
