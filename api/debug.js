export default async function handler(req, res) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  return res.json({
    hasToken: !!token,
    tokenPrefix: token ? token.substring(0, 20) : null,
  });
}
