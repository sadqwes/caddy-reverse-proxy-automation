const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.resolve(__dirname, '../config');

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateRouteMap(domain, subdomain, routes) {
  if (!isPlainObject(routes)) {
    fail(`${subdomain}.${domain}: forwardRoutes must be an object`);
  }

  for (const [from, to] of Object.entries(routes)) {
    if (!from.startsWith('/')) {
      fail(`${subdomain}.${domain}: forward route "${from}" must start with "/"`);
    }

    if (typeof to !== 'string' || !to.trim()) {
      fail(`${subdomain}.${domain}: route target for "${from}" must be a non-empty string`);
    }

    if (!to.startsWith('/')) {
      fail(`${subdomain}.${domain}: route rewrite "${to}" must start with "/"`);
    }
  }
}

function validateSubdomain(domain, subdomain, value) {
  if (!subdomain || typeof subdomain !== 'string') {
    fail(`${domain}: subdomain keys must be non-empty strings`);
  }

  if (typeof value === 'string') {
    if (!value.trim()) {
      fail(`${subdomain}.${domain}: target must be a non-empty string`);
    }
    return;
  }

  if (!isPlainObject(value)) {
    fail(`${subdomain}.${domain}: config must be a string or an object`);
  }

  if (typeof value.target !== 'string' || !value.target.trim()) {
    fail(`${subdomain}.${domain}: target must be a non-empty string`);
  }

  if (value.forwardRoutes !== undefined) {
    validateRouteMap(domain, subdomain, value.forwardRoutes);
  }
}

if (!fs.existsSync(CONFIG_DIR)) {
  fail('config directory not found');
}

const configFiles = fs.readdirSync(CONFIG_DIR).filter((file) => file.endsWith('.json'));

if (configFiles.length === 0) {
  fail('no config files found');
}

for (const file of configFiles) {
  const fullPath = path.join(CONFIG_DIR, file);
  let config;

  try {
    config = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
  } catch (error) {
    fail(`${file}: invalid JSON (${error.message})`);
  }

  if (!isPlainObject(config)) {
    fail(`${file}: config must be a JSON object`);
  }

  if (typeof config.domain !== 'string' || !config.domain.trim()) {
    fail(`${file}: "domain" must be a non-empty string`);
  }

  if (!isPlainObject(config.subdomains) || Object.keys(config.subdomains).length === 0) {
    fail(`${file}: "subdomains" must be a non-empty object`);
  }

  for (const [subdomain, value] of Object.entries(config.subdomains)) {
    validateSubdomain(config.domain, subdomain, value);
  }

  console.log(`✅ ${file} is valid`);
}

console.log(`\n🎉 Validated ${configFiles.length} config file(s)`);
