# Analyze the byte-level corruption pattern

garbled = '灏濊瘯'
expected = '尝试从'

print('Garbled chars:')
for c in garbled:
    print(f'  {c}: U+{ord(c):04X}')
    
print()
print('Expected chars:')
for c in expected:
    print(f'  {c}: U+{ord(c):04X}')

print()
print('Code point deltas:')
for i in range(min(len(garbled), len(expected))):
    print(f'  {ord(garbled[i]):04X} - {ord(expected[i]):04X} = {ord(garbled[i]) - ord(expected[i]):X}')

print()
with open('src/services/geminiService.ts', 'rb') as f:
    raw = f.read()

pattern = '灏濊瘯'.encode('utf-8')
idx = raw.find(pattern)
if idx >= 0:
    print(f'Found at byte offset {idx}')
    print(f'Hex around it: {raw[idx-5:idx+30].hex()}')

print()
print('Garbled as raw hex (each char UTF-8):')
for c in garbled:
    print(f'  {c}: {c.encode("utf-8").hex()}')
