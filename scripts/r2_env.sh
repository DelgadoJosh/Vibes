# Source before any rclone call: configures the "r2" remote from the macOS Keychain
# (service vibes-r2), so no keys ever live in a file. See VibeCoding/docs/vibes-r2-migration.md step 6.
id() { security find-generic-password -s vibes-r2 -a "$1" -w; }
export RCLONE_CONFIG_R2_TYPE=s3 RCLONE_CONFIG_R2_PROVIDER=Cloudflare RCLONE_CONFIG_R2_ACL=private \
       RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
export RCLONE_CONFIG_R2_ENDPOINT="https://$(id account-id).r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$(id access-key-id)"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$(id secret-access-key)"
