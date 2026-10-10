import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// These requests reach only the isolated acceptance server configured on 4173.
test.beforeEach(async ({ request }) => {
  const response = await request.get("/api/todos");
  expect(response.ok()).toBeTruthy();
  for (const task of await response.json()) {
    expect((await request.delete(`/api/todos/${task.id}`)).status()).toBe(204);
  }
});

test("a user can manage a task through its complete lifecycle", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("A clear page. A fresh start.")).toBeVisible();
  await page
    .getByLabel("Task title", { exact: true })
    .fill("Prepare interview");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Review the architecture");
  await page.getByLabel("Due date", { exact: true }).fill("2020-01-15");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Prepare interview", exact: true }),
  ).toBeVisible();

  // Reload proves data comes back from the API, not component memory.
  await page.reload();
  await page.getByLabel("Show tasks").selectOption("overdue");
  await page.getByLabel("Sort by").selectOption("dueDate");
  await page.getByLabel("Sort direction").selectOption("asc");
  const taskLink = page.getByRole("button", {
    name: "Prepare interview",
    exact: true,
  });
  await taskLink.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Edit description")).toHaveValue(
    "Review the architecture",
  );
  await page.getByLabel("Edit title").fill("Ready for interview");
  await page.getByLabel("Edit description").fill("");
  await page.getByLabel("Edit due date").fill("");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("No tasks match this view.")).toBeVisible();

  await page.getByLabel("Show tasks").selectOption("all");
  await page
    .getByRole("checkbox", { name: "Mark Ready for interview complete" })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Mark Ready for interview incomplete" }),
  ).toBeChecked();
  await page.getByLabel("Show tasks").selectOption("completed");
  await expect(
    page.getByRole("button", { name: "Ready for interview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Mark Ready for interview incomplete" })
    .click();
  await expect(page.getByText("No tasks match this view.")).toBeVisible();
  await page.getByLabel("Show tasks").selectOption("incomplete");

  await page
    .getByRole("button", { name: "Delete Ready for interview" })
    .click();
  await page.getByRole("button", { name: "Keep task" }).click();
  await expect(
    page.getByRole("button", { name: "Ready for interview", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Ready for interview" })
    .click();
  await page.getByRole("button", { name: "Delete task", exact: true }).click();
  await expect(page.getByText("No tasks match this view.")).toBeVisible();
  await page.getByLabel("Show tasks").selectOption("all");
  await expect(page.getByText("A clear page. A fresh start.")).toBeVisible();
});

test("the empty and detail views have no detectable accessibility violations", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.getByText("A clear page. A fresh start.")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();

  await request.post("/api/todos", {
    data: { title: "Keyboard accessible task" },
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Keyboard accessible task", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Keyboard accessible task", exact: true }),
  ).toBeFocused();
});
