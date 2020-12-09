import React from "react";
import { render } from "@testing-library/react";

import Extension from "./index";
import ListItem from "../listitem";
import { minimalExtensions, withThemedEditor } from "../../../index.stories";

const Component = withThemedEditor(Extension, [...minimalExtensions, ListItem]);

test("load succesfully", async () => {
  render(<Component />);
});
