const token = import.meta.env.VITE_GH_TOKEN;
export function api(query: any) {
  const headers = new Headers();
  headers.set("Content-Type", "application/json");
  headers.set("Authorization", `bearer ${token}`);
  return fetch("https://api.github.com/graphql", {
    method: "POST",
    body: JSON.stringify({ query }),
    headers,
  });
}
