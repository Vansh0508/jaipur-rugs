"use client";

import { Fragment } from "react";
import { Description, Header, Label, Separator } from "@heroui/react";
import { Dropdown } from "@jaipur-rugs/ui-kit";
import { MoreIcon } from "./icons";

export interface ActionItem {
  id: string;
  label: string;
  icon?: (props: { className?: string }) => React.ReactElement;
  /** Shown under the label — used to say *why* an item is disabled. */
  description?: string;
  variant?: "danger";
  isDisabled?: boolean;
}

export interface ActionSection {
  id: string;
  title?: string;
  items: ActionItem[];
}

/**
 * The ⋮ quick-actions button used on table rows and cards (CarActionsMenu,
 * DriverActionsMenu) — a Hero UI Dropdown; callers only describe sections/items and
 * handle `onAction`. The trigger is a React Aria button, so pressing it doesn't also fire
 * the table row's onAction (usePress stops propagation); on cards it sits above the
 * stretched link via `relative z-10`.
 */
export function ActionsMenu({
  ariaLabel,
  sections,
  onAction,
  isDisabled,
}: {
  ariaLabel: string;
  sections: ActionSection[];
  onAction: (id: string) => void;
  isDisabled?: boolean;
}) {
  const visibleSections = sections.filter((section) => section.items.length > 0);
  const disabledKeys = visibleSections.flatMap((section) => section.items.filter((i) => i.isDisabled).map((i) => i.id));

  return (
    <Dropdown.Root>
      <Dropdown.Trigger
        aria-label={ariaLabel}
        isDisabled={isDisabled}
        className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-foreground disabled:opacity-40"
      >
        <MoreIcon className="h-4 w-4" />
      </Dropdown.Trigger>
      <Dropdown.Popover placement="bottom end" className="min-w-52">
        <Dropdown.Menu aria-label={ariaLabel} disabledKeys={disabledKeys} onAction={(key) => onAction(String(key))}>
          {visibleSections.map((section, index) => (
            <Fragment key={section.id}>
              {index > 0 ? <Separator /> : null}
              <Dropdown.Section>
                {section.title ? <Header>{section.title}</Header> : null}
                {section.items.map(({ id, label, icon: Icon, description, variant }) => (
                  <Dropdown.Item key={id} id={id} textValue={label} variant={variant}>
                    {Icon ? <Icon className={`h-4 w-4 ${variant === "danger" ? "text-danger" : "text-muted"}`} /> : null}
                    <div className="flex flex-col">
                      <Label>{label}</Label>
                      {description ? <Description>{description}</Description> : null}
                    </div>
                  </Dropdown.Item>
                ))}
              </Dropdown.Section>
            </Fragment>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
}
