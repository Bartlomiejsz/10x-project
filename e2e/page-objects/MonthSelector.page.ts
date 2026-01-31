import { type Locator, type Page, expect } from '@playwright/test';

export class MonthSelectorPage {
    readonly page: Page;
    readonly container: Locator;
    readonly prevButton: Locator;
    readonly nextButton: Locator;
    readonly trigger: Locator;
    readonly content: Locator;
    readonly lockIcon: Locator;

    constructor(page: Page) {
        this.page = page;
        this.container = page.getByTestId('month-selector');
        this.prevButton = page.getByTestId('month-selector-prev');
        this.nextButton = page.getByTestId('month-selector-next');
        this.trigger = page.getByTestId('month-selector-trigger');
        this.content = page.getByTestId('month-selector-content');
        this.lockIcon = page.getByTestId('month-selector-lock-icon');
    }

    async openDropdown(): Promise<void> {
        await this.trigger.click();
        await expect(this.content).toBeVisible();
    }

    async closeDropdown(): Promise<void> {
        await this.page.keyboard.press('Escape');
        await expect(this.content).toBeHidden();
    }

    async selectMonth(value: string): Promise<void> {
        await this.openDropdown();
        await this.page.getByTestId(`month-option-${value}`).click();
        await expect(this.content).toBeHidden();
    }

    async goToPreviousMonth(): Promise<void> {
        await this.prevButton.click();
    }

    async goToNextMonth(): Promise<void> {
        await this.nextButton.click();
    }

    async getCurrentValue(): Promise<string> {
        return (await this.trigger.textContent()) ?? '';
    }

    getOptionByValue(value: string): Locator {
        return this.page.getByTestId(`month-option-${value}`);
    }

    async isReadonlyIndicatorVisible(): Promise<boolean> {
        return this.lockIcon.isVisible();
    }

    async isPrevButtonDisabled(): Promise<boolean> {
        return this.prevButton.isDisabled();
    }

    async isNextButtonDisabled(): Promise<boolean> {
        return this.nextButton.isDisabled();
    }

    async getVisibleOptions(): Promise<string[]> {
        await this.openDropdown();
        const options = await this.content.locator('[data-testid^="month-option-"]').allTextContents();
        await this.closeDropdown();
        return options;
    }
}