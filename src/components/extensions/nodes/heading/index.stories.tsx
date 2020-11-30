import React from "react";
import { Story } from "@storybook/react/types-6-0";

import Extension from "./index";
import { extensionMeta } from "../../../index.stories";

export default extensionMeta(Extension);

const Template: Story = (args) => <Extension {...args} />;

export const Default = Template.bind({});
Default.args = {
  text: "hello",
};
