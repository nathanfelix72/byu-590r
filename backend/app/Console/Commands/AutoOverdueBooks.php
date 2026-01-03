<?php

namespace App\Console\Commands;

use App\Mail\OverdueBooksMasterList;
use App\Models\Checkout;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class AutoOverdueBooks extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'auto:overdue-books {--email=}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Returns a list of all overdue books to the admin user AND emails all overdue people';

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        $sendToEmail = $this->option('email');
        if (!$sendToEmail) {
            return Command::FAILURE;
        }

        $overDueCheckouts = Checkout::whereNull('checkin_date')
            ->where('due_date', '<=', date('Y-m-d'))
            ->with(['users', 'books'])->get();

        if ($overDueCheckouts->count() > 0) {
            //Send one main list of all overdue books email to management
            Mail::to($sendToEmail)->send(new OverdueBooksMasterList($overDueCheckouts));
        }

        return Command::SUCCESS;
    }
}

