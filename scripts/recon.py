import os, paramiko, sys

host = '178.83.203.123'
cli = paramiko.SSHClient()
cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
cli.connect(host, port=22, username='root', password=os.environ['DEPLOY_PASS'], timeout=15)

CMDS = [
    ('os', 'uname -a; cat /etc/os-release 2>/dev/null | head -3'),
    ('webservers', 'for s in nginx apache2 httpd caddy docker; do systemctl is-active $s 2>/dev/null | sed "s/^/$s: /"; done; which nginx apache2 httpd caddy docker 2>/dev/null'),
    ('ports', 'ss -tlnp 2>/dev/null | head -40'),
    ('nginx_conf', 'ls /etc/nginx/conf.d/ /etc/nginx/sites-enabled/ 2>/dev/null; nginx -v 2>&1'),
    ('python', 'which python3; python3 -V 2>&1'),
    ('firewall', 'systemctl is-active firewalld 2>/dev/null; which ufw firewall-cmd iptables 2>/dev/null'),
]
for name, cmd in CMDS:
    stdin, stdout, stderr = cli.exec_command(cmd, timeout=20)
    print(f'===== {name} =====')
    print(stdout.read().decode(errors='replace'))
    err = stderr.read().decode(errors='replace').strip()
    if err: print('[stderr]', err[:500])
cli.close()
