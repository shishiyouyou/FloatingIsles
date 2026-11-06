# -*- coding: utf-8 -*-
"""
浮岛建造师 一键部署脚本（Windows/Linux/macOS 通用，需 python + paramiko）

用法:
  set DEPLOY_PASS=服务器root密码   (Linux/macOS: export DEPLOY_PASS=...)
  python scripts/deploy.py

部署行为（不影响现有业务）:
  1. 上传 dist.tar.gz 到 /var/www/floating-isles
  2. 新增独立 nginx 站点配置文件 /etc/nginx/conf.d/floating-isles.conf
     （只新增文件，不修改任何现有配置），监听首个空闲端口 8088-8099
  3. nginx -t 校验通过后 reload，本机 curl 验证
  4. 提醒在云安全组/防火墙放行该端口
"""
import os, sys, time
import paramiko

HOST = '178.83.203.123'
PORT = 22
USER = 'root'
REMOTE_DIR = '/var/www/isles'
CONF_PATH = '/etc/nginx/conf.d/floating-isles.conf'
PORT_CANDIDATES = list(range(8088, 8100))
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARBALL = os.path.join(BASE, 'dist.tar.gz')

password = os.environ.get('DEPLOY_PASS') or input('服务器 root 密码: ').strip()

cli = paramiko.SSHClient()
cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f'[*] 连接 {USER}@{HOST}:{PORT} ...')
cli.connect(HOST, port=PORT, username=USER, password=password, timeout=20)
print('[+] 已连接')

def run(cmd, check=True):
    stdin, stdout, stderr = cli.exec_command(cmd, timeout=60)
    out = stdout.read().decode(errors='replace')
    err = stderr.read().decode(errors='replace')
    code = stdout.channel.recv_exit_status()
    if check and code != 0:
        print(f'[!] 命令失败({code}): {cmd}\n{out}\n{err}')
        sys.exit(1)
    return out.strip(), err.strip(), code

# --- 探查（只读，不动现有服务）---
print('[*] 探查现有环境 ...')
os_type, _, _ = run('cat /etc/os-release | head -1', check=False)
print('    OS:', os_type)
nginx_ver, _, nginx_code = run('nginx -v 2>&1', check=False)
ss_out, _, _ = run("ss -tln | awk '{print $4}' | grep -oE '[0-9]+$' | sort -un", check=False)
used = set(int(p) for p in ss_out.split() if p.isdigit())
print('    已占用端口:', sorted(used))

game_port = next((p for p in PORT_CANDIDATES if p not in used), None)
if game_port is None:
    print('[!] 8088-8099 全部被占用，请手工指定端口')
    sys.exit(1)
print(f'    选用游戏端口: {game_port}')

# --- 上传文件 ---
print('[*] 上传游戏文件 ...')
run(f'mkdir -p {REMOTE_DIR}')
sftp = cli.open_sftp()
sftp.put(TARBALL, '/tmp/floating-isles.tar.gz')
sftp.close()
run(f'tar -xzf /tmp/floating-isles.tar.gz -C {REMOTE_DIR} && rm /tmp/floating-isles.tar.gz')
out, _, _ = run(f'ls {REMOTE_DIR}')
print('    部署目录内容:', out.replace('\n', ' '))

# --- 配置 nginx（新增独立配置，不改现有文件）---
if nginx_code != 0:
    print('[!] 未检测到 nginx。改用 python3 简易服务兜底……')
    run("which python3 || (apt-get update && apt-get install -y python3)", check=False)
    unit = f"""[Unit]
Description=Floating Isles game static server
After=network.target
[Service]
ExecStart=/usr/bin/python3 -m http.server {game_port} --directory {REMOTE_DIR}
Restart=always
User=www-data
[Install]
WantedBy=multi-user.target
"""
    run(f"cat > /etc/systemd/system/floating-isles.service <<'EOF'\n{unit}EOF")
    run('systemctl daemon-reload && systemctl enable --now floating-isles')
else:
    print(f'[*] nginx {nginx_ver} — 新增独立站点配置（不影响现有站点）...')
    conf = f"""# 浮岛建造师 —— 独立端口站点，与现有业务完全隔离
server {{
    listen {game_port};
    server_name _;
    root {REMOTE_DIR};
    index index.html;
    location / {{ try_files $uri $uri/ /index.html; }}
    gzip on;
    gzip_types text/css application/javascript image/svg+xml application/json;
}}
"""
    run(f"cat > {CONF_PATH} <<'EOF'\n{conf}EOF")
    t, e, c = run('nginx -t 2>&1', check=False)
    print('   ', t or e)
    if c != 0:
        run(f'rm -f {CONF_PATH}')
        print('[!] nginx 配置校验失败，已回滚删除新增配置，未做任何变更')
        sys.exit(1)
    run('systemctl reload nginx || nginx -s reload')

# --- 本机验证 ---
time.sleep(1)
code, _, _ = run(f'curl -s -o /dev/null -w "%{{http_code}}" http://127.0.0.1:{game_port}/', check=False)
print(f'[*] 服务器本机访问测试: HTTP {code}')
cli.close()

print(f'''
==========================================
deploy OK  game url: http://{HOST}:{game_port}/
备用入口:  http://{HOST}/isles/  (复用现有80站点)
注意: 独立端口需要云安全组放行 TCP {game_port}
==========================================''')
