export async function POST() {
  return Response.json(
    {
      error: {
        code: "endpoint_retired",
        message: "Email verification codes are no longer used. Sign in with your username and password.",
      },
    },
    { status: 410 },
  );
}
