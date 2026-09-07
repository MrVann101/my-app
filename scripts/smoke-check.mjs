const baseUrl = process.env.BITEWISE_TEST_BASE_URL ?? "http://localhost:3100";
const publicPaths = ["/", "/login", "/signup", "/manifest.webmanifest"];
const protectedApiPaths = ["/api/dashboard", "/api/food/log", "/api/meal-plans", "/api/export/csv"];

async function check(path, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  if (response.status !== expectedStatus) throw new Error(`${path}: expected ${expectedStatus}, received ${response.status}`);
}

for (const path of publicPaths) await check(path, 200);
for (const path of protectedApiPaths) await check(path, 401);
console.log(`Smoke check passed for ${baseUrl}: ${publicPaths.length} public routes and ${protectedApiPaths.length} protected API routes.`);
