import re, glob

files = glob.glob('src/**/*.tsx', recursive=True) + glob.glob('src/**/*.ts', recursive=True)

# Per-line: if line contains '<Button', replace all text-base/text-lg patterns
button_replacements = [
    (r'text-base\s+md:text-lg', 'text-sm'),
    (r'text-sm\s+md:text-base', 'text-sm'),
    (r'\btext-base\b', 'text-sm'),
    (r'\btext-lg\b', 'text-sm'),
]

for f in sorted(files):
    with open(f, 'r', encoding='utf-8') as fh:
        lines = fh.readlines()
    
    modified = False
    for i in range(len(lines)):
        if '<Button' in lines[i]:
            new_line = lines[i]
            for pattern, repl in button_replacements:
                new_line = re.sub(pattern, repl, new_line)
            if new_line != lines[i]:
                lines[i] = new_line
                modified = True
    
    if modified:
        with open(f, 'w', encoding='utf-8') as fh:
            fh.writelines(lines)
        print(f'Modified: {f}')
