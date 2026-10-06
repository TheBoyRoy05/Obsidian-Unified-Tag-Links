import { readFileSync, writeFileSync } from "fs";

const targetPackageVersion = process.env.npm_package_version;

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = targetPackageVersion;
writeFileSync("manifest.json", JSON.stringify(manifest, null, 2) + "\n");

const packageVersions = JSON.parse(readFileSync("versions.json", "utf8"));
if (!(targetPackageVersion in packageVersions)) {
  packageVersions[targetPackageVersion] = manifest.minAppVersion;
  writeFileSync("versions.json", JSON.stringify(packageVersions, null, 2) + "\n");
}
