import React from "react";
import { render, screen } from "@testing-library/react";

import Extension from "./index";
import ListItem from "../listitem";
import { withThemedEditor } from "../../../index.stories";

const Component = withThemedEditor(Extension, <ListItem />);

test("load succesfully", async () => {
  render(<Component />);
});
