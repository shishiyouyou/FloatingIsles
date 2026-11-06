import re
p = '/etc/nginx/sites-enabled/park-metering'
s = open(p).read()
s = re.sub(r'\n *# floating-isles game.*?\n *\}\n?', '\n', s, flags=re.S)
loc = '''
    # floating-isles game (added by deploy; safe to remove this whole block)
    location /isles/ {
        root /var/www;
        try_files $uri $uri/ /isles/index.html;
    }
'''
s = s.rstrip()
assert s.endswith('}'), 'unexpected config tail'
open(p, 'w').write(s[:-1] + loc + '}\n')
print('location block rewritten')
