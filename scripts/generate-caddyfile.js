const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.resolve(__dirname, '../config');

if (!fs.existsSync(CONFIG_DIR)) {
    console.error('❌ config directory not found');
    process.exit(1);
}

// читаем все json файлы
const configFiles = fs.readdirSync(CONFIG_DIR)
    .filter(file => file.endsWith('.json'));

if (configFiles.length === 0) {
    console.error('❌ no config files found');
    process.exit(1);
}

let caddyfile = `# Auto-generated Caddyfile (multi-domain)

{
    log {
        level ERROR
        output file /var/log/caddy/caddy-errors.log {
            roll_size 10MB
            roll_keep 5
        }
    }
}

(common_proxy) {
    header_up X-Real-IP {remote_host}
    header_down -Server
    header_down -X-Powered-By
}

`;

function generateDomain(domain, subdomains) {
    let result = '';

    for (const [sub, value] of Object.entries(subdomains)) {

        let target;
        let forwardRoutes = {};

        if (typeof value === 'string') {
            target = value;
        } else {
            target = value.target;
            forwardRoutes = value.forwardRoutes || {};
        }

        const hasProtocol = target.startsWith('http://') || target.startsWith('https://');
        const proxyTarget = hasProtocol ? target : `https://${target}`;
        const cleanTarget = target.replace(/^https?:\/\//, '');

        const host = `${sub}.${domain}`;

        result += `${host} {\n`;

        // forward rules
        for (const [from, to] of Object.entries(forwardRoutes)) {
            result += `    handle ${from}* {\n`;
            result += `        uri replace ${from} ${to}\n`;
            result += `        reverse_proxy ${proxyTarget} {\n`;
            result += `            header_up Host ${cleanTarget}\n`;
            result += `            import common_proxy\n`;
            result += `        }\n`;
            result += `    }\n\n`;
        }

        // default proxy
        result += `    handle {\n`;
        result += `        reverse_proxy ${proxyTarget} {\n`;
        result += `            header_up Host ${cleanTarget}\n`;
        result += `            import common_proxy\n`;
        result += `        }\n`;
        result += `    }\n`;

        result += `}\n\n`;
    }

    return result;
}

// собираем все домены
for (const file of configFiles) {
    const fullPath = path.join(CONFIG_DIR, file);
    const cfg = require(fullPath);

    if (!cfg.domain || !cfg.subdomains) {
        console.error(`❌ invalid config: ${file}`);
        process.exit(1);
    }

    console.log(`📦 Loading config: ${cfg.domain}`);

    caddyfile += generateDomain(cfg.domain, cfg.subdomains);
}

// записываем файл
fs.writeFileSync('Caddyfile', caddyfile);

console.log(`✅ Generated Caddyfile for ${configFiles.length} domains`);