#!/usr/bin/env python3
"""
Add transparent padding to icon according to Apple HIG
- Keep transparent background
- Shrink content to ~88% of canvas
- Leave transparent margins for macOS rounded corners
"""

import sys
from PIL import Image

def add_transparent_padding(input_path, output_path, content_percent=0.88):
    """
    Add transparent padding around icon content
    
    Args:
        input_path: Source icon
        output_path: Output with padding
        content_percent: How much of canvas the content should fill (0.88 = 88%)
    """
    # Open image
    img = Image.open(input_path).convert("RGBA")
    width, height = img.size
    
    print(f"📐 Original size: {width}x{height}")
    
    # Calculate new content size
    new_size = int(min(width, height) * content_percent)
    
    # Resize content
    img_resized = img.resize((new_size, new_size), Image.LANCZOS)
    
    print(f"📦 Content size: {new_size}x{new_size} ({int(content_percent*100)}% of canvas)")
    
    # Create transparent canvas
    result = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    
    # Center the content
    offset = (width - new_size) // 2
    result.paste(img_resized, (offset, offset), img_resized)
    
    # Save
    result.save(output_path, 'PNG')
    print(f"✅ Saved icon with transparent padding: {output_path}")
    print(f"🎯 Transparent margins: {offset}px on each side")
    print(f"⚠️  Keep this transparent! macOS needs it for rounded corners")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 add-icon-padding.py input.png output.png [content_percent]")
        print("Example: python3 add-icon-padding.py icon.png icon-padded.png 0.88")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    content = float(sys.argv[3]) if len(sys.argv) > 3 else 0.88
    
    add_transparent_padding(input_file, output_file, content)

