import React from "react";
import { Story } from "@storybook/react/types-6-0";

import Extension from "./index";
import { meta } from "../../../index.stories";

export default meta("Marks", Extension);

const Template: Story = (args) => <Extension {...args} />;

export const Default = Template.bind({});
