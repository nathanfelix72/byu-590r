# Demo book images (local + Terraform/S3)

- **Local development**: Files here are copied to `storage/app/public/images/` by `php artisan app:setup-demo-images` (run during `make start`).
- **Deployed environments**: Terraform uploads these to the **dev and prod S3 buckets** at `images/` as part of `terraform apply`. All keys (e.g. `images/hp1.jpeg`, `images/bom.jpg`) are always uploaded; if a specific file is missing, Terraform uses `placeholder.jpg` so the app never 404s.

Expected filenames (matching the seeded book records):

- `bom.jpg`, `hp1.jpeg` … `hp7.jpeg`, `mb1.jpg`, `mb2.jpg`, `mb3.jpg`

The repo includes `placeholder.jpg` (a minimal image). Replace it or add the named files above for real covers; Terraform and the deploy pipeline use whatever is present here.
