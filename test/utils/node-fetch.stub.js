/**
 * node-fetch@3 is ESM-only and is required transitively by the optional
 * Dropbox driver of @amirrivand/nestjs-file-storage. The app never uses that
 * driver (S3 / local disks only); map the import to this stub for Jest.
 */
function nodeFetchStub() {
  throw new Error('node-fetch is not available in Jest (unused in tests)');
}
nodeFetchStub.default = nodeFetchStub;
module.exports = nodeFetchStub;
module.exports.__esModule = true;
