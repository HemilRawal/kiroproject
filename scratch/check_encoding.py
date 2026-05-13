import sys

with open('manufacturer_portal.html', 'rb') as f:
    content = f.read()

# Look for 'Â' (0xC3 0x82 in UTF-8)
if b'\xc3\x82' in content:
    print("Found Â (0xC3 0x82)")
    # Print context
    idx = content.find(b'\xc3\x82')
    print(f"Context: {content[max(0, idx-20):idx+20]}")
else:
    print("Not found Â as 0xC3 0x82")

# Look for 'Â' as Latin-1 encoded in a UTF-8 file (often just 0xC2 if followed by another char like 0xA0)
# But user said Â₹. ₹ is 0xE2 0x82 0xB9.
# If it shows Â₹, it might be 0xC3 0x82 followed by 0xE2 0x82 0xB9.

# Let's check for all 0xC3 0x82
count = content.count(b'\xc3\x82')
print(f"Total count of 0xC3 0x82: {count}")
