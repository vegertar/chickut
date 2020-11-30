import React from "react";
import { Story } from "@storybook/react/types-6-0";

import ListItem from "../listitem";
import * as ListItemStories from "../listitem/index.stories";
import Extension from "./index";
import { extensionMeta } from "../../../index.stories";

export default extensionMeta(Extension);

type Args = {
  listItemArgs?: Record<string, any>;
  myArgs?: Record<string, any>;
};

const Template: Story<Args> = ({ myArgs, listItemArgs }) => (
  <>
    <Extension {...myArgs} />
    <ListItem {...listItemArgs} />
  </>
);

export const Default = Template.bind({});
Default.args = {
  listItemArgs: ListItemStories.Default.args,
};
