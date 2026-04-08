# 1. Update version in version.txt
echo "1.5.0" > version.txt

# 2. Update CHANGELOG.md
nano CHANGELOG.md
# Paste GitHub format at the top

# 3. Commit to GitHub
git add .
git commit -m "v1.5.0 - Neural Sync Update"
git tag -a v1.5.0 -m "Neural Sync Update"
git push origin main --tags

# 4. Create GitHub Release
# Go to GitHub → Releases → New Release
# Select v1.5.0 tag
# Paste the same CHANGELOG content

# 5. Post to Discord
# Copy the Discord Embed format
# Use your bot or webhook to send