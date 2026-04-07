import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { projectSlug } from "./api.js";

describe("projectSlug", () => {
  it("converts github project to gh/ slug", () => {
    assert.equal(
      projectSlug({ vcs_type: "github", username: "myorg", reponame: "myrepo" }),
      "gh/myorg/myrepo"
    );
  });

  it("converts bitbucket project to bb/ slug", () => {
    assert.equal(
      projectSlug({ vcs_type: "bitbucket", username: "team", reponame: "repo" }),
      "bb/team/repo"
    );
  });
});
