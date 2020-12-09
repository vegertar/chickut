import React from "react";
import { render } from "@testing-library/react";

import Extension from "./index";
import { withThemedEditor } from "../../../index.stories";

const Component = withThemedEditor(Extension);

test("load succesfully", async () => {
  render(<Component />);
});
