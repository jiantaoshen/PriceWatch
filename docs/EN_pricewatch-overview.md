# Overview

This is a personal product price-tracking and subscription expense-management system composed of a cloud-based web application, a private local management interface, and a local scraping workflow.

## Problem

The system treats two domains separately:

- **Product**: tracks product prices, sources, target prices, price history, and scraping results.
- **Subscription**: records recurring subscription expenses, focusing on the subscription name, monthly price, currency, and archive status.

The cloud application is responsible for managing products, subscriptions, review workflows, and price history. The local management interface handles scraping operations and scheduling. The data in database are used as the single source of truth.

The goal of this project is to track product prices and monthly subscription costs to find cheaper products, keep subscriptions within budget, and save money. The system should also have clear responsibilities, consistent conventions, stable operation, and long-term maintainability.

## Trade off

### Multi-Source Product Price Comparison

Each Product can have multiple store sources. The system stores both source price and quantity information, then calculates a normalized unit price so that different package sizes can be compared fairly.

For example:

```text
100 SEK / 2 kg => 50 SEK / kg
```

### Separating Product and Subscription

Early versions of Subscription reused too many Product concepts. As the project evolved, the two domains were explicitly separated:

- **Product** => price tracking
- **Subscription** => recurring expense tracking

This keeps the Subscription UI simple and prevents product-specific tracking logic from leaking into the subscription domain.

### Shared Frontend Foundation

Cloud Web and Private Web are two independents Next.js applications. They do not share page-level business logic, but they share the following through npm workspaces:

- Design System
- UI Components
- Shared Types / Utilities
- HTTP Infrastructure

This keeps application responsibilities separate while avoiding duplicated foundation code.

### Single Production Database

Cloud services and local production components use the same Neon PostgreSQL production database. Local scraping results, Cloud Web actions, and Web API data therefore operate against the same source of truth, reducing the complexity of maintaining and synchronizing multiple databases.

### Separating Cloud and Private Components

The Cloud Web and Web API can be deployed independently, while scraping orchestration and browser automation remain on a trusted local device. The main reason for this separation is that some cloud providers do not support browser-based scraping workloads, and some target websites block scraping traffic from cloud environments.
