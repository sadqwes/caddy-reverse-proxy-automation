const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.resolve(__dirname, '../config');

if (!fs.existsSync(CONFIG_DIR)) {
    console.error('❌ config directory not found');
    process.exit(1);
}

// читаем все config файлы
const configFiles = fs.readdirSync(CONFIG_DIR)
    .filter(file => file.endsWith('.json'));

if (configFiles.length === 0) {
    console.error('❌ no config files found');
    process.exit(1);
}

function isValid(status) {
    return status >= 200 && status < 500;
}

async function checkOne(domain, subdomain) {
    const url = `https://${subdomain}.${domain}`;

    try {
        const res = await fetch(url, {
            method: 'HEAD',
            signal: AbortSignal.timeout(5000)
        });

        if (!isValid(res.status)) {
            throw new Error(`Bad status: ${res.status}`);
        }

        console.log(`✅ ${url} → ${res.status}`);
        return true;

    } catch (err) {
        console.error(`❌ ${url} → ${err.message}`);
        return false;
    }
}

async function main() {
    console.log(`🔍 Health check (multi-domain)\n`);

    let allChecks = [];

    for (const file of configFiles) {
        const fullPath = path.join(CONFIG_DIR, file);
        const cfg = require(fullPath);

        if (!cfg.domain || !cfg.subdomains) {
            console.error(`❌ invalid config: ${file}`);
            process.exit(1);
        }

        console.log(`🌐 Domain: ${cfg.domain}`);

        const subs = Object.keys(cfg.subdomains);

        const checks = subs.map(sub => checkOne(cfg.domain, sub));
        allChecks.push(...checks);
    }

    const results = await Promise.all(allChecks);

    const success = results.filter(Boolean).length;
    const total = results.length;

    console.log(`\n📊 ${success}/${total} healthy`);

    if (success !== total) {
        console.error('❌ Health check failed');
        process.exit(1);
    }

    console.log('✅ All services are healthy');
}

main();