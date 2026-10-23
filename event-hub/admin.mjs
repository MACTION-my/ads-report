// Local operator provisioning only; no public user-management endpoint or default accounts.
import {Hub} from './service.mjs';
import {assert} from './core.mjs';
const [path,id,displayName,role]=process.argv.slice(2);
assert(path && id && displayName && ['admin','pic','telesales','viewer'].includes(role),'Usage: node admin.mjs <database-path> <SSO-user-id> <display-name> <admin|pic|telesales|viewer>');
const hub=new Hub(path);
hub.db.prepare('INSERT INTO users(id,displayName,role) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET displayName=excluded.displayName,role=excluded.role').run(id,displayName,role);
hub.close();console.log('Member provisioned. This does not configure or authenticate the identity gateway.');
