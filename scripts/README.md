# Docker Image Validation Script

This script validates Docker images referenced in MDX documentation files to ensure they exist on their respective registries.

## Features

- **Automatic Discovery**: Scans all MDX files in the `docs/` directory
- **Multi-Registry Support**: Validates images on both Docker Hub and Google Container Registry (GCR)
- **Pattern Matching**: Detects various Docker image reference formats:
  - Direct image references: `minaprotocol/mina-daemon:3.1.0-ae112d3-bullseye-mainnet`
  - YAML image fields: `image: 'minaprotocol/...'`
  - Docker commands: `docker pull minaprotocol/...`
  - GCR images: `gcr.io/project/image:tag`
- **Detailed Reporting**: Shows which files reference each image and validation status
- **Location Tracking**: Tracks all locations where each image is used

## Usage

### Using npm script (recommended):

```bash
npm run validate-docker-images
```

### Direct execution:

```bash
node scripts/validate-docker-images.js
```

Or make it executable:

```bash
chmod +x scripts/validate-docker-images.js
./scripts/validate-docker-images.js
```

## Output

The script provides:

1. **Discovery Phase**: Lists all found Docker images and their locations
2. **Validation Phase**: Checks each image against its registry
3. **Summary**: Shows counts of valid, invalid, error, and skipped cases
4. **Detailed Report**: Lists invalid and skipped images with their locations

### Example Output:

```
🔍 Scanning MDX files for Docker images...

Found 364 MDX/MD files

Found 17 unique Docker images

================================================================================

📋 Docker Images Found:

• minaprotocol/mina-daemon:3.1.0-ae112d3-bullseye-mainnet
  Found in 23 file(s):
    - exchange-operators/rosetta/docker-compose.mdx
    - node-developers/sandbox-node.mdx
    - node-operators/generating-a-keypair.mdx
    ... and 20 more

================================================================================

🔍 Validating images...

Checking minaprotocol/mina-daemon:3.1.0-ae112d3-bullseye-mainnet... ✅ EXISTS

================================================================================

📊 SUMMARY:

Total images found: 17
✅ Valid images: 6
❌ Invalid images: 11
⚠️  Errors: 0
⏭️  Skipped images: 0
```

## Exit Codes

- **0**: All images validated successfully, or the only problems were skipped
  images and validation errors (network or API issues)
- **1**: One or more images are missing from their registry

## Supported Registries

### Docker Hub
- Public images from `minaprotocol/*` namespace
- Uses Docker Hub API v2: `https://hub.docker.com/v2/repositories`
- No authentication required for public images

### Google Container Registry (GCR)
- Images from `gcr.io/*`
- Uses Docker Registry HTTP API V2
- Answers the registry authentication challenge with an anonymous pull token,
  so public GCR repositories are validated in the same way as Docker Hub ones.
  A repository that still refuses the token is private and cannot be validated
  without credentials.

## Images That Cannot Be Validated

Some images in the documentation cannot be checked from a public CI runner: the
image sits in a private registry, or it was retired and is no longer published.
Checking them would fail the job for a reason no documentation change can fix.

List each of these in the `UNVERIFIABLE_IMAGES` array in
`validate-docker-images.js`. Each entry has a `pattern` that matches the image
reference and a `reason` that explains why the image cannot be checked. The
script reports matching images as `⏭️ SKIPPED` with the reason, and they do not
fail the job.

```js
const UNVERIFIABLE_IMAGES = [
  {
    pattern: /^gcr\.io\/o1labs-192920\//i,
    reason: 'private o1Labs registry: anonymous pulls are denied, ...',
  },
];
```

Remove an entry as soon as the image becomes publicly resolvable again. Do not
use this list for an image that is simply wrong in the documentation: correct
the documentation instead.

## Limitations

1. **Rate Limiting**: The script includes a 100ms delay between requests to avoid rate limiting, but excessive runs may still hit API limits.

2. **Private Registries**: Only public Docker Hub and GCR registries can be
   validated. Images in a private registry must be listed in
   `UNVERIFIABLE_IMAGES` with a reason.

## Integration with CI/CD

You can add this script to your CI pipeline to catch broken image references:

```yaml
# GitHub Actions example
- name: Validate Docker Images
  run: npm run validate-docker-images
```

```yaml
# GitLab CI example
validate-docker-images:
  script:
    - npm run validate-docker-images
```

## Troubleshooting

### Timeout errors
- Check your internet connection
- Verify the registry URLs are accessible
- Consider increasing the timeout in the script (line 108)

### False positives
- Some registries may temporarily be unavailable
- Rate limiting may cause temporary failures
- Re-run the script to confirm persistent issues

## Contributing

To modify the script:

1. **Add new registries**: Update the validation functions in `validate-docker-images.js`
2. **Skip an unverifiable image**: Add an entry with a reason to `UNVERIFIABLE_IMAGES`
3. **Adjust patterns**: Modify `DOCKER_IMAGE_PATTERNS` array to match new formats
4. **Change timeout**: Adjust the timeout value in `httpsRequest()` function

## Related Documentation

- [Docker Hub API](https://docs.docker.com/docker-hub/api/latest/)
- [Docker Registry HTTP API V2](https://docs.docker.com/registry/spec/api/)
- [Google Container Registry](https://cloud.google.com/container-registry/docs)
