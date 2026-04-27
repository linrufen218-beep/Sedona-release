import re, glob

files = glob.glob('src/**/*.tsx', recursive=True)
non_standard = []

for f in sorted(files):
    with open(f, 'r', encoding='utf-8') as fh:
        content = fh.read()
        lines = content.split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i]
        if '<Button' not in line:
            i += 1
            continue
        
        block_lines = [line]
        if '>' not in line:
            j = i + 1
            while j < len(lines) and '>' not in lines[j]:
                block_lines.append(lines[j])
                j += 1
            if j < len(lines):
                block_lines.append(lines[j])
            i = j + 1
        else:
            i += 1
        
        block = ' '.join(block_lines)
        is_lg = 'size="lg"' in block
        
        sizes = re.findall(r'text-(xs|base|lg|xl|\[[0-9]+px\]|\[[0-9]+px/[0-9]+px\])', block)
        for s in sizes:
            if is_lg and s in ('base', 'lg'):
                continue
            short_block = block.strip()
            if len(short_block) > 150:
                short_block = short_block[:150] + '...'
            non_standard.append(f'{f}:{i-len(block_lines)+1} | {s} | {short_block}')

for entry in non_standard:
    print(entry)
print(f'\nTotal: {len(non_standard)}')
