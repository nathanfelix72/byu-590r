// apiUrl host is replaced at deploy time from GitHub Actions secret EC2_HOST (Terraform output)
export const environment = {
  production: true,
  apiUrl: 'http://__EC2_HOST__:4444/api/',
};
