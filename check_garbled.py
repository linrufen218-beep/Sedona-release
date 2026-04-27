import os

garbled_indicators = ['锛', '銆', '浣犳槸', '瀵煎笀', '閭璇', '閰嶇疆', '鏈嶅姟', '灏濊瘯']

src_dir = 'src'
for root, dirs, files in os.walk(src_dir):
    for f in files:
        if f.endswith(('.ts', '.tsx')):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as fh:
                content = fh.read()
            lines = content.split('\n')
            garbled_lines = []
            for i, line in enumerate(lines):
                for ind in garbled_indicators:
                    if ind in line:
                        garbled_lines.append(i+1)
                        break
            if garbled_lines:
                print(f'{path}: garbled at lines {garbled_lines[:10]}')
