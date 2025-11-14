#!/bin/bash
# Update amino acid names to 3-character versions

for file in docs/design-v2.md docs/implementation-v2-ecs.md src/renderers/ascii-renderer-standalone.html; do
    echo "Updating $file..."
    # Structural
    sed -i 's/\bE120\b/E12/g' "$file"
    sed -i 's/\bC120\b/C12/g' "$file"
    sed -i 's/\bE60\b/EX6/g' "$file"
    sed -i 's/\bC60\b/CP6/g' "$file"
    sed -i 's/\bS\b/STR/g' "$file"  # This might catch too much, be careful
    
    # Binding - need to be careful with order
    sed -i 's/\bBU\b/REMOVED/g' "$file"  # Mark BU for removal
    sed -i 's/\bBA\b/BTA/g' "$file"
    sed -i 's/\bBC\b/BTC/g' "$file"
    sed -i 's/\bBG\b/BTG/g' "$file"
    sed -i 's/\bBT\b/BTT/g' "$file"
done
