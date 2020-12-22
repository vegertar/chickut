import React from "react";
import { Story } from "@storybook/react/types-6-0";

import Extension from "./index";
import { meta } from "../../../index.stories";

export default meta("Nodes", Extension);

type Args = Parameters<typeof Extension>[0];
const Template: Story<Args> = (args) => <Extension {...args} />;

export const Default = Template.bind({});
Default.args = {
  text: `    // Some comments
    line 1 of code
    line 2 of code
    line 3 of code`,
};
